import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import { PythonLintSourceRecord } from "src/core/context/python_lint_source_record";
import { UnusedSymbolReferenceIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_reference_index";
import { ImportedSourceScanner } from "tests/bridge/ts/core/unused_symbol_import_scanner_fixture";
import type { UnusedSymbolDefinition } from "src/core/types";
import type { AstReferenceAlias } from "src/types";

/** Responsibilities: _alias storage_, _alias traversal measurement_. **/
class CountingAliasList extends Array<AstReferenceAlias> {
	public iterations = 0;

	/** Responsibilities: _count alias iteration_. **/
	public override [Symbol.iterator](): ArrayIterator<AstReferenceAlias> {
		this.iterations += 1;
		return super[Symbol.iterator]();
	}
}

describe("unused symbol reference index", () => {
	test("indexes source aliases once and binds every repeated imported reference", () => {
		const ast_model = new AstModel();
		const ast = ast_model.empty_ast_file("python");
		const aliases = new CountingAliasList({ name: "local_target", target: "Target" });
		ast.reference_aliases = aliases;
		ast.symbol_references = [{ name: "local_target", line: 0 }];
		ast.symbol_references = [
			{ name: "local_target", line: 0 },
			{ name: "local_target", line: 1 },
		];
		const source = new PythonLintSourceRecord({
			absolute_path: "/project/consumer.py",
			relative_path: "consumer.py",
			file_name: new LintFileName("consumer.py"),
			text: "local_target\nlocal_target\n",
			normalized_ast: ast,
		});
		const definition: UnusedSymbolDefinition = {
			file: "dependency.py",
			line: 1,
			name: "Target",
			kind: "type",
			owner: "module",
			owner_kind: "module",
			contract_names: [],
		};
		const index = new UnusedSymbolReferenceIndex(
			new ImportedSourceScanner(),
			new Set(["consumer.py", "dependency.py"]),
			new Map([[definition.file, [definition]]]),
		);
		index.prepare();
		index.add_source(source);

		expect({ alias_passes: aliases.iterations, usage_found: index.usage_present(definition) }).toEqual({
			alias_passes: 1,
			usage_found: true,
		});
	});

	test("keeps an unrelated definition unused", () => {
		const ast_model = new AstModel();
		const ast = ast_model.empty_ast_file("python");
		const aliases = new CountingAliasList({ name: "local_target", target: "Target" });
		ast.reference_aliases = aliases;
		ast.symbol_references = [{ name: "unrelated", line: 0 }];
		const source = new PythonLintSourceRecord({
			absolute_path: "/project/consumer.py",
			relative_path: "consumer.py",
			file_name: new LintFileName("consumer.py"),
			text: "local_target\n",
			normalized_ast: ast,
		});
		const definition: UnusedSymbolDefinition = {
			file: "dependency.py",
			line: 1,
			name: "Target",
			kind: "type",
			owner: "module",
			owner_kind: "module",
			contract_names: [],
		};
		const index = new UnusedSymbolReferenceIndex(
			new ImportedSourceScanner(),
			new Set(["consumer.py", "dependency.py"]),
			new Map([[definition.file, [definition]]]),
		);
		index.prepare();
		index.add_source(source);

		expect(index.usage_present(definition)).toBe(false);
	});
});
