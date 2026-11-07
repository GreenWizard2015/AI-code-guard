import { describe, expect, test } from "@jest/globals";
import { RULE_IDS } from "src/linting/constants";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import { GETATTR, SETATTR } from "src/parser/internals/constants";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe("ast verifier registry", () => {
	test("continues traversal without calling fallback for an unregistered leaf", () => {
		const source_file = ts.createSourceFile("unregistered-leaf.ts", "1", ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const verifier = registry.build(source_file.text);

		expect(verifier.verifiers(ts.factory.createNumericLiteral("1"))).toEqual([]);
	});

	test("shares a source-scope index across node-rule groups", () => {
		const text =
			'const object_api = Object; const reflect_api = Reflect; const read = getattr; const write = setattr; object_api.setPrototypeOf(target, Object.prototype); reflect_api.setPrototypeOf(target, Object.prototype); read(target, "field"); write(target, "field", value);';
		const source_file = ts.createSourceFile("shared-rule-index.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));
		const rules = new Set(scenario.rule_ids());

		expect([rules.has(GETATTR), rules.has(SETATTR)]).toEqual([true, true]);
	});

	test("returns all applicable node verifiers and skips unmatched leaves", () => {
		const text =
			"const marker = 1; const checked = value === undefined; const property = value?.field; const element = value?.[key]; const plain = value.field; run.bind(owner);";
		const source_file = ts.createSourceFile("node-verifier-kinds.ts", text, ts.ScriptTarget.Latest, true);
		const traversal = new TypeScriptAstTraversal(source_file);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const node_rules = registry.build(source_file.text);
		const matched_kinds = new Set<ts.SyntaxKind>();
		let has_multiple = false;
		let skips_leaf = false;
		const scenario = new ASTVerifierTestContext(source_file);
		traversal.visit(({ node }) => {
			const selected = node_rules.verifiers(node);
			node_rules.verify(node, scenario);
			if (selected.length > 0) {
				matched_kinds.add(node.kind);
			}
			if (node.kind === ts.SyntaxKind.CallExpression) {
				has_multiple = selected.length > 1;
			}
			if (node.kind === ts.SyntaxKind.NumericLiteral) {
				skips_leaf = selected.length === 0;
			}
		});
		const unsorted_kinds = Array.from(matched_kinds).filter((kind) =>
			[
				ts.SyntaxKind.BinaryExpression,
				ts.SyntaxKind.ElementAccessExpression,
				ts.SyntaxKind.PropertyAccessExpression,
			].includes(kind),
		);
		const kinds = unsorted_kinds.sort((left, right) => left - right);

		expect({
			kinds,
			has_multiple,
			skips_leaf,
			verifier_name: node_rules.name(),
		}).toEqual({
			kinds: [
				ts.SyntaxKind.BinaryExpression,
				ts.SyntaxKind.ElementAccessExpression,
				ts.SyntaxKind.PropertyAccessExpression,
			].sort((left, right) => left - right),
			has_multiple: true,
			skips_leaf: true,
			verifier_name: "ast-verifier",
		});
	});

	test("reports an active type-guard rule on real source", () => {
		const source_file = ts.createSourceFile(
			"type-guard.ts",
			"function is_text(value: string | number): value is string { return typeof value === 'string'; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(scenario.rule_ids()).toContain(RULE_IDS.typescript_type_guard);
	});

	test("reports bind calls on real source", () => {
		const source_file = ts.createSourceFile(
			"bind-call.ts",
			"const callback = service.run.bind(service); const legacy = Function.prototype.bind.call(service.run, service);",
			ts.ScriptTarget.Latest,
			true,
		);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(scenario.rule_ids().filter((rule_id) => rule_id === RULE_IDS.typescript_bind)).toEqual([
			RULE_IDS.typescript_bind,
			RULE_IDS.typescript_bind,
		]);
	});

	test("reports each same-line import issue once for every source occurrence", () => {
		const text = 'import "./first"; import "./second";';
		const source_file = ts.createSourceFile("same-line-imports.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids().filter((rule_id) => rule_id === "relative-import")).toHaveLength(2);
	});

	test("dispatches inline types, type operations, and dictionary returns", () => {
		const text = [
			"type RecordContract = { find(): string };",
			"type RecordAlias = RecordContract;",
			"type Selected = Pick<Account, 'id'>;",
			"function update(value: { id: string }): void {}",
			"function load(): RecordAlias { throw new Error(); }",
			"function get_value(): string { const value = 'ok'; return value; }",
			"function choose(value: string): void { if (value === 'a') { return; } else if (value === 'a') { return; } }",
		].join("\n");
		const source_file = ts.createSourceFile("registered-type-rules.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));
		const rule_ids = scenario.rule_ids();

		expect({
			inline_object: rule_ids.includes("typescript-inline-object-type"),
			type_operation: rule_ids.includes("typescript-type-operation"),
			dictionary_return: rule_ids.includes("typescript-dictionary-return"),
			pointless_assignment: rule_ids.includes(RULE_IDS.pointless_assignment),
			repeated_branch: rule_ids.includes("branch-duplication"),
		}).toEqual({
			inline_object: true,
			type_operation: true,
			dictionary_return: true,
			pointless_assignment: true,
			repeated_branch: true,
		});
	});
});
