import { describe, expect, test } from "@jest/globals";
import { ASTAncestorRelation } from "src/ast_verifier_protocols";
import type { ASTPredicateContract, ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { ASTNodeKindPredicate } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/ast_node_kind_predicate";
import { ASTVerifierPath } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/ast_verifier_path";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import { ASTVerifierTestRule } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_rule";
import ts from "typescript";

describe("AST verifier path", () => {
	test("keeps its registered predicate path when the caller changes its array", () => {
		const predicates: ASTPredicateContract[] = [
			new ASTNodeKindPredicate(ts.SyntaxKind.IfStatement, ASTAncestorRelation.Parent),
		];
		const path = new ASTVerifierPath(predicates, new ASTVerifierTestRule(/condition/));
		predicates.pop();

		const node = ts.factory.createIfStatement(
			ts.factory.createIdentifier("condition"),
			ts.factory.createBlock([], false),
			undefined,
		);

		expect(path.matches_node(node)).toBe(true);
	});

	test("rejects an empty path", () => {
		const rejected_rule: ASTSourceRuleContract = { active_for: () => true, verify: () => undefined };
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const source_file = ts.createSourceFile(
			"valid-after-empty-path.ts",
			"if (target) {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const valid_rule = new ASTVerifierTestRule(/target/u);
		registry.register_path(valid_rule, [
			new ASTNodeKindPredicate(ts.SyntaxKind.IfStatement, ASTAncestorRelation.Parent),
		]);
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(valid_rule.match_count()).toBe(1);
		expect(() => registry.register_path(rejected_rule, [])).toThrow(
			"AST verifier paths must contain at least one predicate.",
		);
	});

	test("matches a registered predicate path through any depth inside a method", () => {
		const source_file = ts.createSourceFile(
			"nested-method-condition.ts",
			"if (outside) {} class Worker { run() { while (ready) { if (inside) {} } } }",
			ts.ScriptTarget.Latest,
			true,
		);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const method_predicate = new ASTNodeKindPredicate(ts.SyntaxKind.MethodDeclaration, ASTAncestorRelation.Parent);
		const if_predicate = new ASTNodeKindPredicate(ts.SyntaxKind.IfStatement, ASTAncestorRelation.AnyAncestor);
		const rule = new ASTVerifierTestRule(/inside/);
		registry.register_path(rule, [method_predicate, if_predicate]);
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(rule.match_count()).toBe(1);
	});

	test("runs one verifier once when multiple paths match the same node", () => {
		const source_file = ts.createSourceFile(
			"duplicate-matching-paths.ts",
			"class Worker { run() { if (target) {} } }",
			ts.ScriptTarget.Latest,
			true,
		);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const method = new ASTNodeKindPredicate(ts.SyntaxKind.MethodDeclaration, ASTAncestorRelation.Parent);
		const any_method_ancestor = new ASTNodeKindPredicate(
			ts.SyntaxKind.MethodDeclaration,
			ASTAncestorRelation.AnyAncestor,
		);
		const condition = new ASTNodeKindPredicate(ts.SyntaxKind.IfStatement, ASTAncestorRelation.AnyAncestor);
		const rule = new ASTVerifierTestRule(/target/);
		registry.register_path(rule, [method, condition]);
		registry.register_path(rule, [any_method_ancestor, condition]);
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(rule.match_count()).toBe(1);
	});

	test("keeps direct-kind dispatch when the same verifier also has a nested path", () => {
		const source_file = ts.createSourceFile(
			"direct-and-nested-dispatch.ts",
			"class Worker { run() { target(); } } target();",
			ts.ScriptTarget.Latest,
			true,
		);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const rule = new ASTVerifierTestRule(/target/u);
		registry.register(rule, [ts.SyntaxKind.CallExpression]);
		registry.register_path(rule, [
			new ASTNodeKindPredicate(ts.SyntaxKind.MethodDeclaration, ASTAncestorRelation.Parent),
			new ASTNodeKindPredicate(ts.SyntaxKind.CallExpression, ASTAncestorRelation.AnyAncestor),
		]);
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(rule.match_count()).toBe(2);
	});

	test("distinguishes direct-parent from any-ancestor matching", () => {
		const source_file = ts.createSourceFile(
			"direct-and-nested-condition-paths.ts",
			"while (ready) { if (inside) {} } if (outside) {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const while_predicate = new ASTNodeKindPredicate(ts.SyntaxKind.WhileStatement, ASTAncestorRelation.Parent);
		const direct_if = new ASTNodeKindPredicate(ts.SyntaxKind.IfStatement, ASTAncestorRelation.Parent);
		const nested_if = new ASTNodeKindPredicate(ts.SyntaxKind.IfStatement, ASTAncestorRelation.AnyAncestor);
		const direct_rule = new ASTVerifierTestRule(/inside/);
		const ancestor_rule = new ASTVerifierTestRule(/inside/);
		registry.register_path(direct_rule, [while_predicate, direct_if]);
		registry.register_path(ancestor_rule, [while_predicate, nested_if]);
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect([direct_rule.match_count(), ancestor_rule.match_count()]).toEqual([0, 1]);
	});

	test("matches an inner node only when both enclosing node kinds are present", () => {
		const source_file = ts.createSourceFile(
			"multi-container-path.ts",
			"class Worker { run() { while (ready) { if (target) {} } } } class Other { run() { if (target) {} } }",
			ts.ScriptTarget.Latest,
			true,
		);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const method = new ASTNodeKindPredicate(ts.SyntaxKind.MethodDeclaration, ASTAncestorRelation.Parent);
		const loop = new ASTNodeKindPredicate(ts.SyntaxKind.WhileStatement, ASTAncestorRelation.AnyAncestor);
		const condition = new ASTNodeKindPredicate(ts.SyntaxKind.IfStatement, ASTAncestorRelation.AnyAncestor);
		const rule = new ASTVerifierTestRule(/target/);
		registry.register_path(rule, [method, loop, condition]);
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(rule.match_count()).toBe(1);
	});

	test("does not activate a path when its source filter misses", () => {
		const source_file = ts.createSourceFile(
			"excluded-method-condition.ts",
			"class Worker { run() { if (outside) {} } }",
			ts.ScriptTarget.Latest,
			true,
		);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const method = new ASTNodeKindPredicate(ts.SyntaxKind.MethodDeclaration, ASTAncestorRelation.Parent);
		const condition = new ASTNodeKindPredicate(ts.SyntaxKind.IfStatement, ASTAncestorRelation.AnyAncestor);
		const rule = new ASTVerifierTestRule(/never-present/);
		registry.register_path(rule, [method, condition]);
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(rule.match_count()).toBe(0);
	});
});
