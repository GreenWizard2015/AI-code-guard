import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import type { UnusedSymbolDefinition } from "src/core/types";
import { UnusedSymbolReferenceIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_reference_index";
import type { AstReferenceAlias } from "src/model/ast/normalized_ast_types";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { LintSourceRecordData } from "src/source_types";
import { ImportedSourceScanner } from "tests/bridge/ts/core/unused_symbol_import_scanner_fixture";
import { UnusedSymbolReferenceScenario } from "tests/linting/orchestration/runtime/global-analysis/unused-symbol-reference-scenario";

describe("unused symbol reference index", () => {
	test("keeps an unrelated definition unused", () => {
		const ast_model = new AstModel("python");
		const aliases: AstReferenceAlias[] = [{ name: "local_target", target: "Target" }];
		const empty_ast = ast_model.empty_ast_file();
		const ast = {
			...empty_ast,
			references: {
				...empty_ast.references,
				reference_aliases: aliases,
				symbol_references: [{ name: "unrelated", line: 0 }],
			},
		};
		const typescript_ast = new TypeScriptAstFile("/project/consumer.py", "");
		const traversal = new TypeScriptAstTraversal(typescript_ast.source_file_node());
		const source: LintSourceRecordData = {
			absolute_path: "/project/consumer.py",
			relative_path: "consumer.py",
			file_name: new LintFileName("consumer.py"),
			text: "local_target\n",
			normalized_ast: ast,
			language: "python",
			typescript_ast,
			source_resolver: new Map(),
			traversal,
		};
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
		index.add_source(source);

		expect(index.usage_present(definition)).toBe(false);
	});

	test("preserves usage for every imported definition", () => {
		const scenario = new UnusedSymbolReferenceScenario();
		const definitions = scenario.imported_definitions();
		const index = new UnusedSymbolReferenceIndex(
			scenario.imported_source_scanner(),
			new Set(["consumer.py", ...definitions.map((item) => item.file)]),
			new Map(definitions.map((item) => [item.file, [item]])),
		);
		index.add_source(scenario.consumer_source());
		const results = definitions.map((item) => index.usage_present(item));

		expect(results).toEqual([true, true, true]);
	});
});
