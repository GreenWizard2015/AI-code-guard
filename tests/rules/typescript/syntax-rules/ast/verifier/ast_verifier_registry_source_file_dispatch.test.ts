import { describe, expect, test } from "@jest/globals";
import { RULE_IDS } from "src/linting/constants";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe("ast verifier registry source file dispatch", () => {
	test("dispatches AST-derived file diagnostics through the source-file verifier", () => {
		const text = [
			"namespace Records {}",
			"export const active = true;",
			"type FirstShape = { value: string };",
			"type SecondShape = { value: string };",
		].join("\n");
		const source_file = ts.createSourceFile("file-scope-rules.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids()).toEqual(expect.arrayContaining(["typescript-namespace-file", "duplicate-type-shape"]));
	});

	test("reports nested classes and types from the source-file AST", () => {
		const text = [
			"function create() {",
			"  class Inner {}",
			"  type Local = string;",
			"  interface LocalContract {}",
			"}",
		].join("\n");
		const source_file = ts.createSourceFile("nested-declarations.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids().filter((rule_id) => rule_id === "nested-class")).toHaveLength(1);
		expect(scenario.rule_ids().filter((rule_id) => rule_id === "nested-type")).toHaveLength(1);
	});

	test("dispatches remaining source aggregates through SourceFile verification", () => {
		const text = [
			"class Worker {}",
			"function build(): void {}",
			"const pending = new Map<string, string>();",
			"function enqueue(key: string, value: string): void { pending.set(key, value); }",
			"function remove(key: string): void { pending.delete(key); }",
			"function _Cache_load(): void {}",
			"function _Cache_save(): void {}",
			"const = ;",
		].join("\n");
		const source_file = ts.createSourceFile("source-aggregates.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));
		const rules = new Set(scenario.rule_ids());

		expect({
			mixed_module: rules.has("mixed-module"),
			hidden_global_state: rules.has("hidden-global-state"),
			class_like_prefix: rules.has("class-like-prefix"),
			parse_error: rules.has("parse-error"),
		}).toEqual({
			mixed_module: true,
			hidden_global_state: true,
			class_like_prefix: true,
			parse_error: true,
		});
	});

	test("reports TypeScript class and exception file summaries through SourceFile", () => {
		const class_text = "class First {}\nclass Second {}";
		const class_file = ts.createSourceFile("classes.ts", class_text, ts.ScriptTarget.Latest, true);
		const class_registry = new ASTVerifierRegistry();
		class_registry.initialize();
		const class_scenario = new ASTVerifierTestContext(class_file);
		class_scenario.append_tree(class_registry.build(class_text));

		const exception_text = "class LocalError extends Error {}";
		const exception_file = ts.createSourceFile("errors.ts", exception_text, ts.ScriptTarget.Latest, true);
		const exception_registry = new ASTVerifierRegistry();
		exception_registry.initialize();
		const exception_scenario = new ASTVerifierTestContext(exception_file);
		exception_scenario.append_tree(exception_registry.build(exception_text));

		expect(class_scenario.rule_ids()).toContain("top-level-classes");
		expect(exception_scenario.rule_ids()).toContain("exception-grouping");
	});

	test("recognizes only top-level function declarations and function-valued bindings", () => {
		const cases = [
			{ callable: "function run(): void {}", grouping_reported: false },
			{ callable: "const run = (): void => {};", grouping_reported: false },
			{ callable: "const run = function (): void {};", grouping_reported: false },
			{ callable: "if (true) { function run(): void {} }", grouping_reported: true },
		];
		const outcomes = cases.map((candidate) => {
			const text = `${candidate.callable}\nclass LocalError extends Error {}`;
			const source_file = ts.createSourceFile("exception-grouping.ts", text, ts.ScriptTarget.Latest, true);
			const registry = new ASTVerifierRegistry();
			registry.initialize();
			const scenario = new ASTVerifierTestContext(source_file);
			scenario.append_tree(registry.build(text));
			return scenario.rule_ids().includes("exception-grouping");
		});

		expect(outcomes).toEqual(cases.map((candidate) => candidate.grouping_reported));
	});

	test("dispatches branch, attribute-depth, and temporal-coupling diagnostics from AST nodes", () => {
		const branches = Array.from({ length: 30 }, () => "if (ready) { run(); }").join(" ");
		const text = [
			`function inspect(): void { ${branches} }`,
			"const value = root.one.two.three.four.five;",
			"class State {",
			"  private value: string;",
			"  prepare(): void { this.value = 'ready'; }",
			"  run(): void { consume(this.value); }",
			"}",
		].join("\n");
		const source_file = ts.createSourceFile("callable-node-rules.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids()).toEqual(
			expect.arrayContaining(["callable-branch-count", "attribute-depth", "temporal-coupling"]),
		);
	});

	test("dispatches type, catch, and retry diagnostics through matching nodes", () => {
		const text = [
			"type Nested = Map<string, Map<string, number>>;",
			"type Handler = (first: string, second: string, third: string, fourth: string) => void;",
			"try { run(); } catch (error) { throw new Error('replacement'); throw new Error('replacement'); }",
			"try {} catch {}",
			"while (true) { try { run(); } catch { continue; } }",
		].join("\n");
		const source_file = ts.createSourceFile("node-scoped-rules.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));
		const rules = new Set(scenario.rule_ids());

		expect({
			nested_generic: rules.has(RULE_IDS.nested_generic_type),
			callable_alias: rules.has(RULE_IDS.callable_type_alias),
			callback_size: rules.has(RULE_IDS.callback_contract_size),
			empty_handler: rules.has("empty-error-handler"),
			error_context: rules.has("error-context-loss"),
			duplicate_translation: rules.has(RULE_IDS.duplicate_error_translation),
			retry_ownership: rules.has("retry-without-ownership"),
		}).toEqual({
			nested_generic: true,
			callable_alias: true,
			callback_size: true,
			empty_handler: true,
			error_context: true,
			duplicate_translation: true,
			retry_ownership: true,
		});
	});

	test("dispatches file-context private-access and Jest diagnostics through the source-file verifier", () => {
		const source_file = ts.createSourceFile(
			"tests/private-access.test.ts",
			[
				"class Vault { private token: string; }",
				"const vault = new Vault();",
				"vault.token;",
				"describe('suite', () => {",
				"  test('small callback', () => {",
				"    expect(true).toBe(true);",
				"    const trailing = true;",
				"  });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(scenario.rule_ids()).toEqual(expect.arrayContaining(["private-member", "typescript-jest-test-ending"]));
	});
});
