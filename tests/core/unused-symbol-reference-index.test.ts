import { describe, expect, jest, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import { PythonLintSourceRecord } from "src/core/context/python_lint_source_record";
import type { UnusedSymbolDefinition } from "src/core/types";
import { UnusedSymbolAliasIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_alias_index";
import { UnusedSymbolReferenceIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_reference_index";
import type { AstReferenceAlias } from "src/types";
import { ImportedSourceScanner } from "tests/bridge/ts/core/unused_symbol_import_scanner_fixture";

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
		const aliases = new CountingAliasList({ name: "local_target", target: "Target" });
		const ast = {
			...ast_model.empty_ast_file("python"),
			reference_aliases: aliases,
			symbol_references: [
				{ name: "local_target", line: 0 },
				{ name: "local_target", line: 1 },
			],
		};
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
		const aliases = new CountingAliasList({ name: "local_target", target: "Target" });
		const ast = {
			...ast_model.empty_ast_file("python"),
			reference_aliases: aliases,
			symbol_references: [{ name: "unrelated", line: 0 }],
		};
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

	test("resolves imported definitions once per source name and preserves each usage site", () => {
		const aliases = jest.spyOn(UnusedSymbolAliasIndex.prototype, "names");
		const scanner = new ImportedSourceScanner();
		jest.spyOn(scanner, "resolved_imports").mockReturnValue(new Set(["first.py", "second.py", "third.py"]));
		const ast_model = new AstModel();
		const empty_ast = ast_model.empty_ast_file("python");
		const ast = {
			...empty_ast,
			reference_aliases: [{ name: "local_target", target: "Target" }],
			symbol_references: [
				{ name: "local_target", line: 0 },
				{ name: "local_target", line: 1 },
			],
		};
		const source = new PythonLintSourceRecord({
			absolute_path: "/project/consumer.py",
			relative_path: "consumer.py",
			file_name: new LintFileName("consumer.py"),
			text: "local_target\nlocal_target\n",
			normalized_ast: ast,
		});
		const definitions = ["first.py", "second.py", "third.py"].map((file) => ({
			file,
			line: 1,
			name: "Target",
			kind: "type",
			owner: "module",
			owner_kind: "module" as const,
			contract_names: [],
		}));
		const index = new UnusedSymbolReferenceIndex(
			scanner,
			new Set(["consumer.py", ...definitions.map((item) => item.file)]),
			new Map(definitions.map((item) => [item.file, [item]])),
		);
		index.prepare();
		index.add_source(source);

		const result = {
			alias_resolutions: aliases.mock.calls.filter((call) => call[1] === "local_target").length,
			all_imported_definitions_used: definitions.every((item) => index.usage_present(item)),
		};
		aliases.mockRestore();

		expect(result).toEqual({ alias_resolutions: 3, all_imported_definitions_used: true });
	});
});
