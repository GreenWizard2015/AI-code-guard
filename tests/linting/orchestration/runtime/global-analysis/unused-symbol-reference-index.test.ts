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
import { TypeScriptReexportTestFixture } from "tests/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/type_script_reexport_test_fixture";
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
			file: "/project/dependency.py",
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

	test("resolves an alias to a definition in the same source", () => {
		const scenario = new UnusedSymbolReferenceScenario();
		const source = scenario.consumer_source();
		const definition: UnusedSymbolDefinition = {
			file: source.relative_path,
			line: 1,
			name: "Target",
			kind: "type",
			owner: "module",
			owner_kind: "module",
			contract_names: [],
		};
		const index = new UnusedSymbolReferenceIndex(
			scenario.imported_source_scanner(),
			new Set([source.absolute_path]),
			new Map([[source.absolute_path, [definition]]]),
		);
		index.add_source(source);
		const used = index.usage_present(definition);

		expect(used).toBe(true);
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

	test("resolves each Python source import binding once for multiple referenced names", () => {
		const scenario = new UnusedSymbolReferenceScenario();
		const consumer = scenario.consumer_source();
		const consumer_source = {
			...consumer.normalized_ast.source,
			python_imports: [
				{
					line: 1,
					kind: "from" as const,
					module: "dependency",
					names: [
						{ name: "TargetA", alias: "local_a" },
						{ name: "TargetB", alias: "local_b" },
					],
				},
			],
		};
		const consumer_references = {
			...consumer.normalized_ast.references,
			reference_aliases: [
				{ name: "local_a", target: "TargetA" },
				{ name: "local_b", target: "TargetB" },
			],
			symbol_references: [
				{ name: "local_a", line: 0 },
				{ name: "local_b", line: 1 },
			],
		};
		const indexed_consumer = {
			...consumer,
			normalized_ast: { ...consumer.normalized_ast, source: consumer_source, references: consumer_references },
		};
		const dependency = { ...consumer, absolute_path: "/project/dependency.py", relative_path: "dependency.py" };
		const definitions: UnusedSymbolDefinition[] = ["TargetA", "TargetB"].map((name) => ({
			file: "/project/dependency.py",
			line: 1,
			name,
			kind: "type",
			owner: "module",
			owner_kind: "module",
			contract_names: [],
		}));
		const scanner = new ImportedSourceScanner([], "/project/dependency.py");
		const index = new UnusedSymbolReferenceIndex(
			scanner,
			new Set(["/project/consumer.py", "/project/dependency.py"]),
			new Map([["/project/dependency.py", definitions]]),
		);
		index.add_source(indexed_consumer);
		index.add_source(dependency);
		const results = definitions.map((definition) => index.usage_present(definition));

		expect({ results, import_resolutions: scanner.resolved_path_count() }).toEqual({
			results: [true, true],
			import_resolutions: 1,
		});
	});

	test("records a TypeScript type used through an imported barrel", () => {
		const fixture = new TypeScriptReexportTestFixture(
			new Map([
				["/project/consumer.ts\u0000./barrel", "/project/barrel.ts"],
				["/project/barrel.ts\u0000./definition", "/project/definition.ts"],
			]),
		);
		const { sources, definition, definitions_by_file } = fixture.type_usage_case();
		const index = new UnusedSymbolReferenceIndex(fixture, new Set(sources.keys()), definitions_by_file);
		for (const source of sources.values()) {
			index.add_source(source);
		}
		const used = index.usage_present(definition);

		expect(used).toBe(true);
	});
});
