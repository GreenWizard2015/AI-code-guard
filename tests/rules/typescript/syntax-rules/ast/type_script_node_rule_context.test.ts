import { describe, expect, test } from "@jest/globals";
import { LintStageTimer } from "src/lint_stage_timer";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptNodeRuleContext } from "src/rules/typescript/syntax-rules/ast/type_script_node_rule_context";
import ts from "typescript";

describe("TypeScript node rule context", () => {
	test("binds direct rule diagnostics to the node's source line", () => {
		const source_file = ts.createSourceFile(
			"src/example.ts",
			"\nconst second = 2;",
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		for (const node of source_file.statements) {
			const node_context = new TypeScriptNodeRuleContext(
				node,
				source_file.fileName,
				source_file,
				violations,
				new LintStageTimer(),
			);
			node_context.append_rule("private-member");
		}

		expect(violations.map((violation) => [violation.rule_id(), violation.line()])).toEqual([["private-member", 2]]);
	});

	test("renders parameters for node-bound diagnostics", () => {
		const source_file = ts.createSourceFile(
			"src/example.ts",
			"\nlet second = 2;",
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		for (const node of source_file.statements) {
			const node_context = new TypeScriptNodeRuleContext(
				node,
				source_file.fileName,
				source_file,
				violations,
				new LintStageTimer(),
			);
			node_context.append_parameterized_rule("typescript-module-variable", { name: "second" });
		}

		expect(violations.map((violation) => [violation.rule_id(), violation.line(), violation.message()])).toEqual([
			["typescript-module-variable", 2, 'module-level variable "second" is not allowed'],
		]);
	});

	test("applies language-compatible diagnostic rules to the bound node", () => {
		const source_file = ts.createSourceFile(
			"src/example.ts",
			"\nclass Example {}",
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		for (const node of source_file.statements) {
			const context = new TypeScriptNodeRuleContext(
				node,
				source_file.fileName,
				source_file,
				violations,
				new LintStageTimer(),
			);
			context.append_diagnostic_rule(new DiagnosticRule("typescript-getter"));
			context.append_diagnostic_rule(new DiagnosticRule("python-static-method"));
		}

		expect(violations.map((violation) => [violation.rule_id(), violation.line()])).toEqual([["typescript-getter", 2]]);
	});
});
