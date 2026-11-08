import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("cross-language conditional execution policy", () => {
	const disallowed_syntax_files: Record<string, string> = {
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
	};

	const allowed_syntax_files: Record<string, string> = {
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
	};

	test("reports disallowed conditional expressions and assignment forms", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			disallowed_syntax_files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const conditional_findings = violations.filter((item) => item.rule_id() === "conditional-execution");
		const conditional_locations = conditional_findings.map((item) => `${item.file()}:${item.line()}`).sort();
		const logical_assignment_locations = violations
			.filter((item) => item.message() === "avoid logical assignment operators")
			.map((item) => `${item.file()}:${item.line()}`)
			.sort();
		const ternary_locations = violations
			.filter((item) => item.message() === "avoid ternary expressions")
			.map((item) => `${item.file()}:${item.line()}`);

		expect({
			conditional_locations,
			conditional_control_flow: conditional_findings
				.filter((item) => item.file() === "control-flow-conditions.ts" || item.file() === "conditional-spread.ts")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
			boolean_identity: violations
				.filter((item) => item.rule_id() === "pointless-boolean-operation")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
			membership: violations
				.filter((item) => item.rule_id() === "typescript-in-operator")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
			logical_assignment_locations,
			ternary_locations,
		}).toEqual({
			conditional_locations: [
				"call-argument.ts:1",
				"conditional-containers.py:6",
				"conditional-containers.py:7",
				"conditional-spread.ts:3",
				"conditional.py:2",
				"conditional.py:3",
				"conditional.py:5",
				"conditional.ts:2",
				"conditional.ts:3",
				"conditional.ts:5",
				"conditional.ts:6",
				"conditional.ts:7",
				"control-flow-conditions.ts:1",
				"control-flow-conditions.ts:2",
				"control-flow-conditions.ts:3",
				"nested-call-argument.ts:1",
				"returned-object-property.ts:2",
			],
			conditional_control_flow: [
				"conditional-spread.ts:3",
				"control-flow-conditions.ts:1",
				"control-flow-conditions.ts:2",
				"control-flow-conditions.ts:3",
			],
			boolean_identity: ["boolean-identity.ts:2", "boolean-identity.ts:3"],
			membership: ["membership-positions.ts:3", "membership-positions.ts:4"],
			logical_assignment_locations: ["dispatch.ts:2", "dispatch.ts:4", "dispatch.ts:5"],
			ternary_locations: [],
		});
	});

	test("allows boolean short-circuit conditions and standalone logical expressions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			allowed_syntax_files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const allowed_files = Object.keys(allowed_syntax_files);
		const unexpected = violations
			.filter((item) => item.message() === "avoid conditional execution operators")
			.filter((item) => allowed_files.includes(item.file()))
			.map((item) => `${item.file()}:${item.line()}`);

		expect({ allowed_files: allowed_files.length, unexpected }).toEqual({ allowed_files: 4, unexpected: [] });
	});
});
