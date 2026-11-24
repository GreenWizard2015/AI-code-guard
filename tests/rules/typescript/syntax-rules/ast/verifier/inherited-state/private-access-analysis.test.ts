import { describe, expect, test } from "@jest/globals";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import { TypeScriptStaticExpressionOperations } from "src/parser/type_script_static_expression_operations";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptFilePrivateMemberRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_private_member_rules";
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
		const stage_timer = new LintStageTimer();
		const rule = new PrivateAccessAnalysis({
			source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal,
			stage_timer,
		});
		traversal.visit(({ node }) => rule.append_node(node));

		rule.append_private_access(violations, source_file.fileName);

		const stage_names = stage_timer.durations().map((stage) => stage.name);
		expect({
			violations: violations.map((violation) => [violation.rule_id(), violation.line()]),
			has_property_measurement: stage_names.includes(
				"file-analysis.typescript.script-rule.private-member-access.reference-resolution.properties",
			),
			has_import_measurement: stage_names.includes(
				"file-analysis.typescript.script-rule.private-member-access.reference-resolution.imports",
			),
		}).toEqual({
			violations: [["private-member", 7]],
			has_property_measurement: true,
			has_import_measurement: true,
		});
	});

	test("skips reference resolution for a private member used only by its declaring class", () => {
		const source_text = [
			"class Vault {",
			"  private token: string;",
			"  read(): string { return this.token; }",
			"}",
		].join("\n");
		const ast_file = new TypeScriptAstFile("src/vault.ts", source_text);
		const source_file = ast_file.source_file_node();
		const traversal = new TypeScriptAstTraversal(source_file);
		const violations: ViolationContract[] = [];
		const stage_timer = new LintStageTimer();
		const rule = new PrivateAccessAnalysis({
			source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal,
			stage_timer,
		});
		traversal.visit(({ node }) => rule.append_node(node));

		rule.append_private_access(violations, source_file.fileName);

		expect(violations).toHaveLength(0);
		expect(stage_timer.durations()).toHaveLength(0);
	});

	test("still resolves same-named private members declared by different classes", () => {
		const source_text = [
			"class Vault { private token: string; }",
			"class Reader {",
			"  private token: string;",
			"  read(vault: Vault): string { return vault.token; }",
			"}",
		].join("\n");
		const ast_file = new TypeScriptAstFile("src/vault.ts", source_text);
		const source_file = ast_file.source_file_node();
		const traversal = new TypeScriptAstTraversal(source_file);
		const violations: ViolationContract[] = [];
		const rule = new PrivateAccessAnalysis({
			source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal,
			stage_timer: new LintStageTimer(),
		});
		traversal.visit(({ node }) => rule.append_node(node));

		rule.append_private_access(violations, source_file.fileName);

		expect(violations.map((violation) => [violation.rule_id(), violation.line()])).toEqual([["private-member", 4]]);
	});

	test("ignores access to a public member", () => {
		const source_text = ["class Vault { token: string; }", "const vault = new Vault();", "vault.token;"].join("\n");
		const ast_file = new TypeScriptAstFile("src/vault.ts", source_text);
		const source_file = ast_file.source_file_node();
		const traversal = new TypeScriptAstTraversal(source_file);
		const violations: ViolationContract[] = [];
		const stage_timer = new LintStageTimer();
		const rule = new PrivateAccessAnalysis({
			source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal,
			stage_timer,
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
		const stage_timer = new LintStageTimer();
		const rule = new PrivateAccessAnalysis({
			source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal,
			stage_timer,
		});
		traversal.visit(({ node }) => rule.append_node(node));

		rule.append_private_access(violations, source_file.fileName);

		expect(violations).toHaveLength(0);
	});

	test("resolves accesses after collecting private members declared later in the file", () => {
		const source_text = ["const vault = new Vault();", "vault.token;", "class Vault { private token: string; }"].join(
			"\n",
		);
		const ast_file = new TypeScriptAstFile("src/vault.ts", source_text);
		const source_file = ast_file.source_file_node();
		const traversal = new TypeScriptAstTraversal(source_file);
		const violations: ViolationContract[] = [];
		const rule = new PrivateAccessAnalysis({
			source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal,
			stage_timer: new LintStageTimer(),
		});
		traversal.visit(({ node }) => rule.append_node(node));

		rule.append_private_access(violations, source_file.fileName);

		expect(violations.map((violation) => [violation.rule_id(), violation.line()])).toEqual([["private-member", 2]]);
	});

	test("activates only for files that can declare class private members", () => {
		const rule = new TypeScriptFilePrivateMemberRules();
		const sources = [
			{ source: "class Vault { private token: string; }", active: true },
			{ source: "const Vault = class { #token = 1; };", active: true },
			{ source: "const token = target[key];", active: false },
			{ source: "interface Vault { token: string; }", active: false },
		];

		expect(sources.map(({ source }) => rule.active_for(source))).toEqual(sources.map(({ active }) => active));
	});
});
