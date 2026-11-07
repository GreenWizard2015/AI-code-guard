import { describe, expect, test } from "@jest/globals";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import type { ViolationContract } from "src/reporting_protocols";
import { PrivateAccessAnalysis } from "src/rules/typescript/syntax-rules/ast/verifier/inherited-state/private_access_analysis";

describe("private member access", () => {
	test("reports external access and allows access owned by the declaring class", () => {
		const source_text = [
			"class Vault {",
			"  private token: string;",
			"  label: string;",
			"  read(): string { return this.token; }",
			"}",
			"const vault = new Vault();",
			"vault.token;",
			"vault.label;",
		].join("\n");
		const ast_file = new TypeScriptAstFile("src/vault.ts", source_text);
		const source_file = ast_file.source_file_node();
		const traversal = new TypeScriptAstTraversal(source_file);
		const violations: ViolationContract[] = [];
		const rule = new PrivateAccessAnalysis({
			source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal,
		});
		traversal.visit(({ node }) => rule.append_node(node));

		rule.append_private_access(violations, source_file.fileName);

		expect(violations.map((violation) => [violation.rule_id(), violation.line()])).toEqual([["private-member", 7]]);
	});

	test("ignores access to a public member", () => {
		const source_text = ["class Vault { token: string; }", "const vault = new Vault();", "vault.token;"].join("\n");
		const ast_file = new TypeScriptAstFile("src/vault.ts", source_text);
		const source_file = ast_file.source_file_node();
		const traversal = new TypeScriptAstTraversal(source_file);
		const violations: ViolationContract[] = [];
		const rule = new PrivateAccessAnalysis({
			source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal,
		});
		traversal.visit(({ node }) => rule.append_node(node));

		rule.append_private_access(violations, source_file.fileName);

		expect(violations).toHaveLength(0);
	});

	test("ignores public accesses when the file declares unrelated private members", () => {
		const source_text = [
			"class Vault { private token: string; label: string; }",
			"const vault = new Vault();",
			"vault.label;",
		].join("\n");
		const ast_file = new TypeScriptAstFile("src/vault.ts", source_text);
		const source_file = ast_file.source_file_node();
		const traversal = new TypeScriptAstTraversal(source_file);
		const violations: ViolationContract[] = [];
		const rule = new PrivateAccessAnalysis({
			source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal,
		});
		traversal.visit(({ node }) => rule.append_node(node));

		rule.append_private_access(violations, source_file.fileName);

		expect(violations).toHaveLength(0);
	});
});
