import { describe, expect, test } from "@jest/globals";
import { PrivateMemberAccess } from "src/linting/orchestration/runtime/typescript-rule-groups/private-member-access/private_member_access";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { ViolationContract } from "src/reporting_protocols";
import ts from "typescript";

describe("private member access", () => {
	test("reports external access and allows access owned by the declaring class", () => {
		const source_file = ts.createSourceFile(
			"src/vault.ts",
			[
				"class Vault {",
				"  private token: string;",
				"  read(): string { return this.token; }",
				"}",
				"const vault = new Vault();",
				"vault.token;",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const traversal = new TypeScriptAstTraversal(source_file);
		traversal.collect();
		const violations: ViolationContract[] = [];
		const rule = new PrivateMemberAccess();

		rule.append_private_access(violations, source_file.fileName, source_file, traversal);

		expect(violations.map((violation) => [violation.rule_id, violation.line])).toEqual([["private-member", 6]]);
	});

	test("ignores access to a public member", () => {
		const source_file = ts.createSourceFile(
			"src/vault.ts",
			["class Vault { token: string; }", "const vault = new Vault();", "vault.token;"].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const traversal = new TypeScriptAstTraversal(source_file);
		traversal.collect();
		const violations: ViolationContract[] = [];
		const rule = new PrivateMemberAccess();

		rule.append_private_access(violations, source_file.fileName, source_file, traversal);

		expect(violations).toHaveLength(0);
	});
});
