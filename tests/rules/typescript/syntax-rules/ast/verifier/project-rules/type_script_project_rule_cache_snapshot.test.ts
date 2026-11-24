import { describe, expect, jest, test } from "@jest/globals";
import { TypeScriptRuleScope } from "src/core/lint-analysis/type_script_rule_scope";
import { SourceFileMapCache } from "src/core/project-source/source_file_map_cache";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptRuleContext } from "src/linting/type_script_rule_context";
import { AstPropertySourceIndexCache } from "src/model/ast/ast_property_source_index_cache";
import { ViolationValue } from "src/model/violation_value";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { ProjectRuleSnapshots, ProjectSourceAnalysisOptionsContract } from "src/project_analysis_types";
import { TypeScriptProjectRuleCache } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_rule_cache";
import type { LintSourceRecordData } from "src/source_types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import { TestFixture } from "tests/core/test-fixture";
import { ASTVerifierTestProjectNames } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_project_names";

describe("TypeScript project rule result snapshots", () => {
	const source_file_map_cache = new SourceFileMapCache();
	/** Responsibilities: _project verification request_. **/
	const request_for = (
		source: LintSourceRecordData,
		analysis: ProjectSourceAnalysisOptionsContract,
	): TypeScriptNodeVerificationRequest => {
		const source_file = source.typescript_ast.source_file_node();
		const project_context = analysis.context();
		const project_records = project_context.files();
		const typescript_records = project_records.filter((record) => record.language === "typescript");
		const source_resolver = source_file_map_cache.for_map(
			new Map(typescript_records.map((record) => [record.absolute_path, record.typescript_ast.source_file_node()])),
		);
		const module_exports: TypeScriptModuleExportsContract = {
			module_symbol: () => "",
			resolve: (reference) => reference,
			symbol_kind: () => ResolvedTypeScriptDeclarationKind.Other,
		};
		const name_registry = new ASTVerifierTestProjectNames(source);
		const project_names = name_registry.names();
		const context = new TypeScriptRuleContext([], source.absolute_path, source_file, {
			normalized_ast: source.normalized_ast,
			project_names,
			rule_scope: new TypeScriptRuleScope(analysis),
			source_resolver,
			module_exports,
			source_index: new AstPropertySourceIndexCache(),
			stage_timer: new LintStageTimer(),
			traversal: source.traversal,
		});
		return { node: source_file, context };
	};

	test("uses captured project violations without rerunning the project rule", () => {
		const fixture_builder = new TestFixture();
		const result = fixture_builder._project_source.with_in_memory_project(
			{ "src/feature.ts": "export const feature = 1;\n" },
			({ root, context, files, source_texts }) => {
				const fixture = { root, paths: [...files], source_texts };
				const base_scope = fixture_builder._project_source.project_source_analysis_options(fixture, context, new Set());
				const source = context.source_record(`${root}/src/feature.ts`);
				const file = source.absolute_path;
				const project_rule_snapshots: ProjectRuleSnapshots = [
					{
						rule_name: "Object",
						files: [
							{
								file,
								violations: [
									{
										file,
										line: 1,
										message: "captured message",
										hint: "captured hint",
										rule_id: "captured-rule",
										priority: 4,
									},
								],
							},
						],
					},
				];
				base_scope.project_rule_snapshots().push(...project_rule_snapshots);
				const analysis_scope = base_scope;
				const request = request_for(source, analysis_scope);
				const analysis = { collect_project_violations: jest.fn(() => []) };
				const cache = new TypeScriptProjectRuleCache();
				const violations = cache.violations_for_source(request, analysis);
				const collection = analysis.collect_project_violations;
				const collection_calls = collection.mock.calls;
				const collection_count = collection_calls.length;

				return {
					file,
					collection_count,
					violations: violations.map((violation) => [
						violation.file(),
						violation.line(),
						violation.message(),
						violation.hint(),
						violation.rule_id(),
						violation.priority(),
					]),
				};
			},
			new Map(),
		);

		expect(result.collection_count).toBe(0);
		expect(result.violations).toEqual([[result.file, 1, "captured message", "captured hint", "captured-rule", 4]]);
	});

	test("captures the rule's grouped project results when snapshot collection is enabled", () => {
		const fixture_builder = new TestFixture();
		const result = fixture_builder._project_source.with_in_memory_project(
			{ "src/feature.ts": "export const feature = 1;\n" },
			({ root, context, files, source_texts }) => {
				const fixture = { root, paths: [...files], source_texts };
				const base_scope = fixture_builder._project_source.project_source_analysis_options(fixture, context, new Set());
				const source = context.source_record(`${root}/src/feature.ts`);
				const project_rule_snapshots = base_scope.project_rule_snapshots();
				const analysis_scope = base_scope;
				const request = request_for(source, analysis_scope);
				const analysis = {
					collect_project_violations: (): ViolationValue[] => [
						new ViolationValue({
							file: source.absolute_path,
							line: 1,
							message: "collected message",
							hint: "collected hint",
							rule_id: "collected-rule",
							priority: 3,
						}),
					],
				};
				const cache = new TypeScriptProjectRuleCache();
				const violations = analysis_scope.capture_snapshots_during(() =>
					cache.violations_for_source(request, analysis),
				);
				const serialized_snapshot = JSON.stringify([...project_rule_snapshots]);

				return { file: source.absolute_path, violations, serialized_snapshot };
			},
			new Map(),
		);

		const expected_snapshot = JSON.stringify([
			{
				rule_name: "Object",
				files: [
					{
						file: result.file,
						violations: [
							{
								file: result.file,
								line: 1,
								message: "collected message",
								hint: "collected hint",
								rule_id: "collected-rule",
								priority: 3,
							},
						],
					},
				],
			},
		]);
		expect(result.serialized_snapshot).toBe(expected_snapshot);
		expect(result.violations.map((violation) => violation.rule_id())).toEqual(["collected-rule"]);
	});

	test("runs project analysis when the snapshot has no entry for an inactive rule", () => {
		const fixture_builder = new TestFixture();
		const result = fixture_builder._project_source.with_in_memory_project(
			{ "src/feature.ts": "export const feature = 1;\n" },
			({ root, context, files, source_texts }) => {
				const fixture = { root, paths: [...files], source_texts };
				const base_scope = fixture_builder._project_source.project_source_analysis_options(fixture, context, new Set());
				const source = context.source_record(`${root}/src/feature.ts`);
				const analysis_scope = base_scope;
				analysis_scope.project_rule_snapshots().push({ rule_name: "OtherRule", files: [] });
				const request = request_for(source, analysis_scope);
				const analysis = { collect_project_violations: jest.fn(() => []) };
				const cache = new TypeScriptProjectRuleCache();
				const violations = cache.violations_for_source(request, analysis);
				const collection = analysis.collect_project_violations;
				const collection_calls = collection.mock.calls;
				const collection_count = collection_calls.length;

				return { collection_count, violations };
			},
			new Map(),
		);

		expect(result.collection_count).toBe(1);
		expect(result.violations).toEqual([]);
	});
});
