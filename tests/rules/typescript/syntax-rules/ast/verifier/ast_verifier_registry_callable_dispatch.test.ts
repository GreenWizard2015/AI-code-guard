import { describe, expect, test } from "@jest/globals";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { EMPTY_PROJECT_NAMES } from "tests/core/constants";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe("ast verifier registry callable dispatch", () => {
	test("keeps object return analysis scoped to each rule context", () => {
		const text = "interface Result { run(): void } function create(): Result { return { run(): void {} }; }";
		const source_file = ts.createSourceFile("contextual-object-return.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const contract_context = new ASTVerifierTestContext(source_file, {
			...EMPTY_PROJECT_NAMES,
			project_interface_names: new Set(["Result"]),
		});
		const contract_context_project_scoped = contract_context.state().project.rule_scope.project_scope();
		contract_context.append_tree(registry.build(text));
		const plain_context = new ASTVerifierTestContext(source_file, EMPTY_PROJECT_NAMES);
		const plain_context_project_scoped = plain_context.state().project.rule_scope.project_scope();
		plain_context.append_tree(registry.build(text));

		expect({
			contract_context_project_scoped,
			plain_context_project_scoped,
			contract_context: contract_context.rule_ids().includes("typescript-object-literal-return"),
			plain_context: plain_context.rule_ids().includes("typescript-object-literal-return"),
		}).toEqual({
			contract_context_project_scoped: false,
			plain_context_project_scoped: false,
			contract_context: true,
			plain_context: false,
		});
	});

	test("dispatches shared parameter analysis through class declaration nodes", () => {
		const text = [
			"class SourceText {",
			"  source_text(file: string): string { return file; }",
			"  source_available(file: string): boolean { return file.length > 0; }",
			"  source_lines(file: string): string[] { return [file]; }",
			"}",
		].join("\n");
		const source_file = ts.createSourceFile("shared-parameter.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids()).toContain("shared-parameter");
	});

	test("dispatches declaration names and contract fields through declaration nodes", () => {
		const text = ["interface Store { cache: string; }", "type InvalidContract = string;"].join("\n");
		const source_file = ts.createSourceFile("declaration-rules.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		const rule_ids = [...scenario.rule_ids()];
		const declaration_rule_ids = rule_ids.filter(
			(item) =>
				item !== "file-min-size" && item !== "module-protocols-separation" && item !== "module-types-separation",
		);
		declaration_rule_ids.sort();

		expect(declaration_rule_ids).toEqual(["contract-fields", "contract-naming", "contract-naming", "responsibilities"]);
	});

	test("dispatches function metric diagnostics through function declarations", () => {
		const parameters = Array.from({ length: 20 }, (_, index) => `value_${index}: string`).join(", ");
		const text = `function inspect(${parameters}): void {}`;
		const source_file = ts.createSourceFile("function-metrics.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids()).toContain("argument-count");
	});

	test("dispatches callable naming and generic-type diagnostics through callable owners", () => {
		const text = "class Reader { get_record(value: unknown): unknown { throw new Error(); } }";
		const source_file = ts.createSourceFile("callable-contracts.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids()).toEqual(
			expect.arrayContaining(["method-get-name", "type-info", "type-info", "typescript-unknown-parameter-type"]),
		);
	});

	test("dispatches project type-boundary diagnostics through callable, class, and field nodes", () => {
		const text = [
			"class DomainModel {}",
			"class ViewState { public model: DomainModel; public read(model: DomainModel): void {} }",
			"function render(model: DomainModel): void {}",
			"type RenderOptions = { model: DomainModel };",
		].join("\n");
		const source_file = ts.createSourceFile("project-boundary.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file, {
			...EMPTY_PROJECT_NAMES,
			project_class_names: new Set(["DomainModel"]),
			typescript_class_names: new Set(["DomainModel"]),
		});
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids().filter((rule_id) => rule_id === "project-type-boundary")).toHaveLength(4);
	});

	test("reports project boundary fields on their actual source line", () => {
		const text = ["class DomainModel {}", "class ViewState { public model: DomainModel; }"].join("\n");
		const source_file = ts.createSourceFile("project-boundary-field.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file, {
			...EMPTY_PROJECT_NAMES,
			project_class_names: new Set(["DomainModel"]),
			typescript_class_names: new Set(["DomainModel"]),
		});
		scenario.append_tree(registry.build(text));

		const violations = scenario.violations();
		const boundary_violations = violations.filter((violation) => violation.rule_id() === "project-type-boundary");
		const source_lines = boundary_violations.map((violation) => violation.line());
		expect(source_lines).toEqual([2]);
	});
});
