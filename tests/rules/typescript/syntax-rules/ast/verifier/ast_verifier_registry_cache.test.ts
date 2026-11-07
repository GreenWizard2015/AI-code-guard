import { describe, expect, test } from "@jest/globals";
import { ASTAncestorRelation } from "src/ast_verifier_protocols";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { ASTNodeKindPredicate } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/ast_node_kind_predicate";
import { ASTVerifierTestRule } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_rule";
import ts from "typescript";

describe("AST verifier registry cache", () => {
	test("reuses dispatch for an unchanged active-rule signature", () => {
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const first = registry.build("const item = 1;");
		const repeated = registry.build("const item = 1;");

		expect(repeated).toBe(first);
	});

	test("invalidates dispatch after rule registration", () => {
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const source_code = "const item = 1;";
		const before_registration = registry.build(source_code);
		const rule = new ASTVerifierTestRule(/item/u);
		registry.register(rule, [ts.SyntaxKind.Identifier]);
		const after_registration = registry.build(source_code);

		expect(after_registration).not.toBe(before_registration);
	});

	test("invalidates dispatch after path registration", () => {
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const source_code = "const item = 1;";
		const rule = new ASTVerifierTestRule(/item/u);
		registry.register(rule, [ts.SyntaxKind.Identifier]);
		const before_path = registry.build(source_code);
		const predicate = new ASTNodeKindPredicate(ts.SyntaxKind.Identifier, ASTAncestorRelation.Parent);
		registry.register_path(rule, [predicate]);
		const after_path = registry.build(source_code);

		expect(after_path).not.toBe(before_path);
	});

	test("uses activation bits as the one-entry cache key", () => {
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		registry.register(new ASTVerifierTestRule(/item/u), [ts.SyntaxKind.Identifier]);
		const active_source = "const item = 1;";
		const first_active = registry.build(active_source);
		const repeated_active = registry.build(active_source);
		const inactive = registry.build("const other = 1;");
		const active_after_replacement = registry.build(active_source);

		expect({
			reused: repeated_active === first_active,
			activation_changed: inactive !== first_active,
			replaced: active_after_replacement !== first_active,
		}).toEqual({ reused: true, activation_changed: true, replaced: true });
	});

	test("invalidates dispatch after registry initialization", () => {
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const before_initialization = registry.build("const item = 1;");
		registry.initialize();
		const after_initialization = registry.build("const item = 1;");

		expect(after_initialization).not.toBe(before_initialization);
	});
});
