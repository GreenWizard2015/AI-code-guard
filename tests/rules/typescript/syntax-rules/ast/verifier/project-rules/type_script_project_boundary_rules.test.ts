import { describe, expect, test } from "@jest/globals";
import type { ProjectNames } from "src/project_analysis_types";
import { TypeScriptProjectBoundaryNameSets } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_boundary_name_sets";
import { TypeScriptProjectBoundaryRules } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_boundary_rules";
import { EMPTY_PROJECT_NAMES } from "tests/core/constants";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe("TypeScript project boundary rules", () => {
	test("reports boundary violations for the visited class", () => {
		const text = "class DomainModel {} class ViewState { public model: DomainModel; }";
		const source_file = ts.createSourceFile("project-boundary.ts", text, ts.ScriptTarget.Latest, true);
		const context = new ASTVerifierTestContext(source_file, {
			...EMPTY_PROJECT_NAMES,
			project_class_names: new Set(["DomainModel"]),
			typescript_class_names: new Set(["DomainModel"]),
		});
		const context_source_file = context.state().source.source_file;
		const view_state: ts.Node =
			context_source_file.statements.find(
				(statement) => ts.isClassDeclaration(statement) && statement.name?.text === "ViewState",
			) ?? context_source_file;

		const rule = new TypeScriptProjectBoundaryRules();
		rule.verify({ node: view_state, context });

		expect(context.rule_ids()).toContain("project-type-boundary");
	});

	test("reuses name sets for the same project identity", () => {
		const project_names: ProjectNames = {
			...EMPTY_PROJECT_NAMES,
			typescript_class_names: new Set(["ContractName"]),
			typescript_alias_names: new Set(["ContractName"]),
		};
		const name_sets = new TypeScriptProjectBoundaryNameSets();
		const first_result = name_sets.names(project_names);
		const repeated_result = name_sets.names(project_names);

		expect(repeated_result).toBe(first_result);
	});

	test("keeps allowed names isolated between project identities", () => {
		const first_project: ProjectNames = {
			...EMPTY_PROJECT_NAMES,
			typescript_class_names: new Set(["SharedName", "Concrete"]),
			typescript_alias_names: new Set(["SharedName"]),
		};
		const second_project: ProjectNames = {
			...EMPTY_PROJECT_NAMES,
			typescript_class_names: new Set(["SharedName", "Concrete"]),
			typescript_alias_names: new Set(["Concrete"]),
		};
		const name_sets = new TypeScriptProjectBoundaryNameSets();
		const first_result = name_sets.names(first_project);
		const second_result = name_sets.names(second_project);

		expect({
			separate_results: first_result !== second_result,
			first_classes: [...first_result.project_class_names],
			second_classes: [...second_result.project_class_names],
		}).toEqual({
			separate_results: true,
			first_classes: ["Concrete"],
			second_classes: ["SharedName"],
		});
	});
});
