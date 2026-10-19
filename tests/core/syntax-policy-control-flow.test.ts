import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("cross-language conditional execution policy", () => {
	test("reports disallowed conditional expressions and assignment forms", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"conditional.ts": [
					'const label = ready ? "yes" : "no";',
					"ready && submit();",
					"ready || recover();",
					"const state = left && right;",
					"const wrapped = (ready && load());",
					"const callback = ready && (() => submit());",
					"const created = value ?? create();",
				].join("\n"),
				"conditional.py": [
					'label = "yes" if ready else "no"',
					"ready and submit()",
					"ready or recover()",
					"state = left and right",
					"callback = ready and (lambda: submit())",
				].join("\n"),
				"boolean-identity.ts": [
					"function is_ready(value: boolean): boolean {",
					"\tif (value === true) { return true; }",
					"\tif (value == false) { return false; }",
					"\treturn value;",
					"}",
				].join("\n"),
				"control-flow-conditions.ts": [
					"if (ready && load()) {}",
					"while (ready && load()) {}",
					"for (; ready && load();) {}",
				].join("\n"),
				"membership-positions.ts": [
					"declare const member_name: string;",
					"declare const record: object;",
					"const first = member_name in record;",
					"while (member_name in record) {}",
				].join("\n"),
				"call-argument.ts": "consume(value ?? fallback());",
				"nested-call-argument.ts": "report(enabled && run());",
				"returned-object-property.ts": [
					"function build(enabled: boolean, run: () => string): { result: string } {",
					"return { result: enabled && run() };",
					"}",
				].join("\n"),
				"conditional-spread.ts": [
					"declare const enabled: boolean;",
					"declare function run(): object;",
					"void { ...(enabled && run()) };",
				].join("\n"),
				"conditional-containers.py": [
					"def fallback() -> str:",
					'    return "fallback"',
					"def consume(value: str) -> None:",
					"    pass",
					"ready = True",
					"consume(ready and fallback())",
					"callback = lambda value: value and fallback()",
				].join("\n"),
				"dispatch.ts": [
					"let value: string | undefined;",
					"value ??= create_value();",
					"let enabled = false;",
					"enabled ||= is_enabled();",
					"enabled &&= is_enabled();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		/** Responsibilities: _count violations by message_. **/
		const message_count = (message: string): number => violations.filter((item) => item.message === message).length;
		expect({
			conditional_operators: message_count("avoid conditional execution operators"),
			conditional_control_flow: violations.filter(
				(item) =>
					item.rule_id === "conditional-execution" &&
					(item.file === "control-flow-conditions.ts" || item.file === "conditional-spread.ts"),
			).length,
			boolean_identity: violations.filter((item) => item.rule_id === "pointless-boolean-operation").length,
			membership: violations.filter((item) => item.rule_id === "typescript-in-operator").length,
			logical_assignments: message_count("avoid logical assignment operators"),
			type_conditional: message_count("avoid ternary expressions"),
		}).toEqual({
			conditional_operators: 18,
			conditional_control_flow: 4,
			boolean_identity: 2,
			membership: 2,
			logical_assignments: 3,
			type_conditional: 0,
		});
	});

	test("allows boolean short-circuit conditions and standalone logical expressions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"standalone.ts": "true && false;\ntrue || false;",
				"standalone.py": "True and False\nTrue or False",
				"boolean-conditions.ts": [
					"const left: boolean = true;",
					"const right = 1 < 2;",
					"const first = left && right;",
					"const second = (left || right) && !left;",
				].join("\n"),
				"boolean-calls.ts": [
					"function is_ready(): boolean { return true; }",
					"class State { public is_open(): boolean { return true; } }",
					"const state = new State();",
					"const first = is_ready() || state.is_open();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.message === "avoid conditional execution operators")).toHaveLength(0);
	});
});
