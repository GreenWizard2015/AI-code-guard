import { describe, expect, test } from "@jest/globals";
import { TypeScriptRuleScope } from "src/core/lint-analysis/type_script_rule_scope";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import { DIRECTORY_RULE_IDS } from "src/rules/constants";
import { TypeScriptProjectFileRules } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_file_rules";
import { TestFixture } from "tests/core/test-fixture";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";

describe("TypeScript project file rules", () => {
	test("project scope exposes its analysis and selects sources by language", () => {
		const fixture_builder = new TestFixture();
		const result = fixture_builder._project_source.with_in_memory_project(
			{
				"src/application.ts": "export const application = 1;\n",
				"src/worker.py": "worker = 1\n",
			},
			({ root, context, files, source_texts }) => {
				const fixture = { root, paths: [...files], source_texts };
				const analysis = fixture_builder._project_source.project_source_analysis_options(fixture, context, new Set());
				const rule_scope = new TypeScriptRuleScope(analysis);
				const typescript_sources = rule_scope.source_files("typescript");
				return {
					analysis_matches: rule_scope.project_analysis() === analysis,
					typescript_sources_reused: rule_scope.source_files("typescript") === typescript_sources,
					typescript_files: typescript_sources.map((source) => source.relative_path),
					python_files: rule_scope.source_files("python").map((source) => source.relative_path),
				};
			},
			new Map(),
		);

		expect(result).toEqual({
			analysis_matches: true,
			typescript_sources_reused: true,
			typescript_files: ["src/application.ts"],
			python_files: ["src/worker.py"],
		});
	});

	test("reports directory violations once from the owning source after another file is visited first", () => {
		const fixture_builder = new TestFixture();
		const rules = new TypeScriptProjectFileRules();
		const result = fixture_builder._project_source.with_in_memory_project(
			{
				"features/first.ts": "export const first = 1;\n",
				"features/second.ts": "export const second = 2;\n",
			},
			({ root, context, files, source_texts }) => {
				const project_fixture = { root, paths: [...files], source_texts };
				const analysis = fixture_builder._project_source.project_source_analysis_options(
					project_fixture,
					context,
					new Set(),
				);
				const sources = context.files().filter((source) => source.language === "typescript");
				const reversed_sources = [...sources];
				reversed_sources.reverse();
				return reversed_sources.map((source) => {
					const ast_file = new TypeScriptAstFile(source.relative_path, source.text);
					const source_file = ast_file.source_file_node();
					const request_context = new ASTVerifierTestContext(source_file);
					rules.append_directory_rules({ node: source_file, context: request_context }, analysis);
					const violations = request_context.violations();
					return violations.map((violation) => ({
						file: violation.file(),
						rule: violation.rule_id(),
					}));
				});
			},
			new Map(),
		);

		expect(result).toEqual([[], [{ file: "features", rule: DIRECTORY_RULE_IDS.minimum }]]);
	});

	test("recomputes directory results for a different project scope", () => {
		const fixture_builder = new TestFixture();
		const rules = new TypeScriptProjectFileRules();
		const result = fixture_builder._project_source.with_in_memory_project(
			{
				"features/first.ts": "export const first = 1;\n",
				"features/second.ts": "export const second = 2;\n",
				"features/third.ts": "export const third = 3;\n",
			},
			({ root, context, files, source_texts }) => {
				const fixture = { root, paths: [...files], source_texts };
				const analysis = fixture_builder._project_source.project_source_analysis_options(fixture, context, new Set());
				const selected_scope: ProjectSourceAnalysisOptions = {
					...analysis,
					directory_files: { virtual_project: true, files: files.slice(0, 2) },
				};
				const ast_file = new TypeScriptAstFile("features/first.ts", "export const first = 1;\n");
				const source_file = ast_file.source_file_node();
				const collect = (scope: ProjectSourceAnalysisOptions): string[] => {
					const context_for_source = new ASTVerifierTestContext(source_file);
					const request = { node: source_file, context: context_for_source };
					rules.append_directory_rules(request, scope);
					return context_for_source.violations().map((violation) => violation.rule_id());
				};
				return [collect(selected_scope), collect(analysis)];
			},
			new Map(),
		);

		expect(result).toEqual([[DIRECTORY_RULE_IDS.minimum], []]);
	});

	test("reports test rules only for files in the in-memory project source set", () => {
		const fixture_builder = new TestFixture();
		const rules = new TypeScriptProjectFileRules();
		const result = fixture_builder._project_source.with_in_memory_project(
			{
				"src/feature.ts": "export const feature = 1;\n",
				"tests/unknown/unscoped.test.ts": "export {};\n",
			},
			({ root, context, files, source_texts }) => {
				const fixture = { root, paths: [...files], source_texts };
				const scope = fixture_builder._project_source.project_source_analysis_options(fixture, context, new Set());
				const project_source = context
					.files()
					.find((source) => source.relative_path === "tests/unknown/unscoped.test.ts");
				if (project_source === undefined) {
					return { in_project: [], outside_project: [] };
				}
				const project_ast_file = new TypeScriptAstFile(project_source.relative_path, project_source.text);
				const project_file = project_ast_file.source_file_node();
				const project_context = new ASTVerifierTestContext(project_file);
				rules.append_test_rules({ node: project_context.state().source.source_file, context: project_context }, scope);

				const outside_ast_file = new TypeScriptAstFile("tests/unknown/outside.test.ts", "export {};\n");
				const outside_file = outside_ast_file.source_file_node();
				const outside_context = new ASTVerifierTestContext(outside_file);
				rules.append_test_rules({ node: outside_file, context: outside_context }, scope);

				return {
					in_project_source_file: project_context.state().source.file,
					in_project: project_context
						.violations()
						.map((violation) => violation.rule_id())
						.sort(),
					outside_project: outside_context.violations().map((violation) => violation.rule_id()),
				};
			},
			new Map(),
		);

		expect(result).toEqual({
			in_project_source_file: "tests/unknown/unscoped.test.ts",
			in_project: ["test-file-organization", "test-targets"],
			outside_project: [],
		});
	});
});
