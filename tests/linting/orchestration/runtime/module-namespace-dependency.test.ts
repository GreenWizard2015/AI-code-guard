import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { TypeScriptScannerProjectNames } from "src/linting/orchestration/runtime/typescript/type_script_scanner_project_names";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { TypeScriptScannerOptions } from "src/model_types";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { ViolationContract } from "src/reporting_protocols";
import type { SourceFileAstContract } from "src/source_protocols";
import { ParsedSourceFiles } from "tests/bridge/ts/runner/orchestration/runtime/parsed_source_files";
import { EMPTY_PROJECT_NAMES } from "tests/core/constants";
import { ProjectNameMembershipProbe } from "tests/linting/orchestration/runtime/project-name-membership-probe";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";

describe("module namespace dependencies", () => {
	const source_files = new ParsedSourceFiles();

	/** Responsibilities: _project import-name scan fixture_. **/
	const project_import_name_fixture = (
		text: string,
	): {
		ast_file: TypeScriptAstFile;
		options: TypeScriptScannerOptions;
		calls: { module_paths: string[]; resolved_bindings: string[] };
		initial_names: Set<string>;
	} => {
		const ast_file = new TypeScriptAstFile("/project/current.ts", text);
		const module_paths = new Map([
			["./internal", "/project/internal.ts"],
			["vendor", "/vendor/index.d.ts"],
			["./models", "/project/models.ts"],
			["external", "/vendor/external.d.ts"],
		]);
		const module_path_calls: string[] = [];
		const binding_calls: string[] = [];
		/** Responsibilities: _import module path resolution_. **/
		const module_symbol = (_file: string, module_name: string): string => {
			module_path_calls.push(module_name);
			return module_paths.get(module_name) ?? "";
		};
		const resolved = new Set([
			"/project/internal.ts:default",
			"/project/internal.ts:Internal",
			"/vendor/index.d.ts:Vendor",
			"/project/models.ts:Base",
		]);
		/** Responsibilities: _imported declaration resolution_. **/
		const resolve = ({ file, name }: { file: string; name: string }): { file: string; name: string } => {
			binding_calls.push(`${file}:${name}`);
			let resolved_file = "";
			if (resolved.has(`${file}:${name}`)) {
				resolved_file = file;
			}
			return { file: resolved_file, name };
		};
		const resolver: TypeScriptModuleResolverContract = {
			module_symbol,
			resolve,
			symbol_kind: () => ResolvedTypeScriptDeclarationKind.Other,
		};
		const source_file = ast_file.source_file_node();
		const options = {
			source: {
				file_name: new LintFileName("/project/current.ts"),
				text,
				ast_file,
				traversal: new TypeScriptAstTraversal(source_file),
				stage_timer: new LintStageTimer(),
			},
			names: {
				project_class_names: new Set<string>(),
				typescript_class_names: new Set<string>(),
				project_interface_names: new Set<string>(),
				project_type_names: new Set<string>(),
				project_alias_names: new Set<string>(),
				project_contract_names: new Set<string>(),
				project_boundary_types: new Set<string>(),
				project_boundary_contracts: new Set<string>(),
			},
			project_name_inventory: new Set<string>(),
			module_scope: {
				module_resolver: resolver,
				project_files: new Set(["/project/internal.ts", "/project/models.ts"]),
			},
		} satisfies TypeScriptScannerOptions;
		return {
			ast_file,
			options,
			calls: { module_paths: module_path_calls, resolved_bindings: binding_calls },
			initial_names: new Set(["Existing", "External", "ExternalNamespace"]),
		};
	};

	/** Responsibilities: _file-scoped TypeScript lint execution_. **/
	const lint_file_scope = (
		source_ast: SourceFileAstContract,
		stage_timer: LintStageTimer,
		filesystem_fallback: boolean,
	): ViolationContract[] => {
		const context = new ASTVerifierTestContext(source_ast.snapshot().source_file);
		const state = context.state();
		const rule_scope = state.project.rule_scope;
		const linter = new CodingRuleLinter(rule_scope, ".", new SourceText(), EMPTY_PROJECT_NAMES, filesystem_fallback);
		return linter.lint_typescript(source_ast, stage_timer);
	};

	test("reports an imported namespace passed to a constructor", () => {
		const violations = lint_file_scope(
			source_files.parse_typescript(
				"reader.ts",
				[
					'import * as platform from "node:fs";',
					"class Reader { public constructor(dependency: object) {} }",
					"new Reader(platform);",
				].join("\n"),
			),
			new LintStageTimer(),
			false,
		);
		const reports = violations.filter((violation) => violation.rule_id() === "typescript-module-namespace-dependency");
		const report_lines = reports.map((violation) => violation.line());
		expect(report_lines).toEqual([3]);
	});

	test("reports an import-equals module passed to a constructor", () => {
		const violations = lint_file_scope(
			source_files.parse_typescript(
				"reader.ts",
				[
					'import platform = require("node:fs");',
					"class Reader { public constructor(dependency: object) {} }",
					"new Reader(platform);",
				].join("\n"),
			),
			new LintStageTimer(),
			false,
		);
		const reports = violations.filter((violation) => violation.rule_id() === "typescript-module-namespace-dependency");
		const report_lines = reports.map((violation) => violation.line());
		expect(report_lines).toEqual([3]);
	});

	test("collects project import names with one path and binding lookup per import", () => {
		const text = [
			'import DefaultItem, { Internal as Alias } from "./internal";',
			'import { Vendor as External } from "vendor";',
			'import * as Models from "./models";',
			'import * as ExternalNamespace from "external";',
			"class Child extends Models.Base {}",
		].join("\n");
		const fixture = project_import_name_fixture(text);
		const project_names = new ProjectNameMembershipProbe({ contains: (name) => fixture.initial_names.has(name) }, []);
		const normalized_ast = fixture.ast_file.normalized();
		const scanner = new TypeScriptScannerProjectNames(fixture.options, fixture.ast_file, normalized_ast, project_names);
		scanner.collect();
		const import_results = {
			default_import: scanner.contains("DefaultItem"),
			aliased_import: scanner.contains("Alias"),
			base_project_name: scanner.contains("Existing"),
			namespace_base: scanner.contains("Models.Base"),
			external_import: scanner.contains("External"),
		};
		const resolver_results = {
			module_paths: fixture.calls.module_paths.length,
			resolved_bindings: fixture.calls.resolved_bindings.length,
		};
		expect({ import_results, resolver_results }).toEqual({
			import_results: {
				default_import: true,
				aliased_import: true,
				base_project_name: true,
				namespace_base: true,
				external_import: false,
			},
			resolver_results: { module_paths: 4, resolved_bindings: 4 },
		});
	});

	test("keeps shared project-name views membership-only", () => {
		const membership_queries: string[] = [];
		const shared_names = new Set(["Existing", "External", "ExternalNamespace"]);
		const shared_inventory = new ProjectNameMembershipProbe(
			{ contains: (name) => shared_names.has(name) },
			membership_queries,
		);
		const file_views: TypeScriptScannerProjectNames[] = [];
		for (let index = 0; index < 24; index += 1) {
			const fixture = project_import_name_fixture(`class File${index} {}`);
			const normalized_ast = fixture.ast_file.normalized();
			const scanner = new TypeScriptScannerProjectNames(
				fixture.options,
				fixture.ast_file,
				normalized_ast,
				shared_inventory,
			);
			scanner.collect();
			file_views.push(scanner);
		}
		const view_membership = file_views.map((view) => view.contains("Existing"));
		const queries_are_membership_only = membership_queries.every((name) => name === "Existing");
		expect({
			view_count: file_views.length,
			all_views_find_shared_name: view_membership.every(Boolean),
			membership_query_count: membership_queries.length,
			queries_are_membership_only,
		}).toEqual({
			view_count: 24,
			all_views_find_shared_name: true,
			membership_query_count: 24,
			queries_are_membership_only: true,
		});
	});

	test("classifies project and external imported bases", () => {
		const fixture = project_import_name_fixture(
			[
				'import DefaultItem, { Internal as Alias } from "./internal";',
				'import { Vendor as External } from "vendor";',
				'import * as Models from "./models";',
				'import * as ExternalNamespace from "external";',
				"class Child extends Models.Base {}",
				"class ExternalChild extends External {}",
			].join("\n"),
		);
		const shared_inventory = new ProjectNameMembershipProbe(
			{ contains: (name) => fixture.initial_names.has(name) },
			[],
		);
		const normalized_ast = fixture.ast_file.normalized();
		const scanner = new TypeScriptScannerProjectNames(
			fixture.options,
			fixture.ast_file,
			normalized_ast,
			shared_inventory,
		);
		scanner.collect();
		const source_ast = normalized_ast.source;
		const classes = source_ast.classes;
		const ast_model = new AstModel("typescript");
		ast_model.mark_external_bases(classes, scanner);
		const import_results = {
			default_import: scanner.contains("DefaultItem"),
			aliased_import: scanner.contains("Alias"),
			base_project_name: scanner.contains("Existing"),
			namespace_base: scanner.contains("Models.Base"),
			external_import: scanner.contains("External"),
			external_namespace: scanner.contains("ExternalNamespace"),
		};
		const external_base_classification = classes.map((class_node) => class_node.classification.extends_external_class);
		expect({ import_results, external_base_classification }).toEqual({
			import_results: {
				default_import: true,
				aliased_import: true,
				base_project_name: true,
				namespace_base: true,
				external_import: false,
				external_namespace: false,
			},
			external_base_classification: [false, true],
		});
	});
});
