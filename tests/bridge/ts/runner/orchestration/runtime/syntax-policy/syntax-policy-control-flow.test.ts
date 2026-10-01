import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint syntax and policy rules", () => {
	test("rejects ternary expressions and conditional execution operators", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
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
		});

		expect(messages.filter((message) => message === "avoid ternary expressions")).toHaveLength(0);
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(9);
	});

	test("allows logical expressions outside assignments", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"standalone.ts": "true && false;\ntrue || false;",
			"standalone.py": "True and False\nTrue or False",
		});

		expect(messages).not.toContain("avoid conditional execution operators");
	});

	test("rejects conditional execution in control-flow conditions", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"control-flow-conditions.ts": [
				"if (ready && load()) {}",
				"while (ready && load()) {}",
				"for (; ready && load();) {}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "conditional-execution")).toHaveLength(3);
	});

	test("rejects invalid membership outside if statements", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"membership-positions.ts": [
				"declare const member_name: string;",
				"declare const record: object;",
				"const first = member_name in record;",
				"while (member_name in record) {}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-in-operator")).toHaveLength(2);
	});

	test("rejects nullish coalescing in call arguments", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"call-argument.ts": "consume(value ?? fallback);",
		});
		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(1);
	});

	test("rejects conditional execution in call arguments and lambdas", () => {
		const test_fixture = new TestFixture();
		const messages = test_fixture.violation_messages({
			"conditional-containers.py": [
				"def fallback() -> str:",
				'    return "fallback"',
				"def consume(value: str) -> None:",
				"    pass",
				"ready = True",
				"consume(ready and fallback())",
				"callback = lambda value: value and fallback()",
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid conditional execution operators")).toHaveLength(2);
	});

	test("allows short-circuit expressions with boolean operands", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"boolean-conditions.ts": [
				"const left: boolean = true;",
				"const right = 1 < 2;",
				"const first = left && right;",
				"const second = (left || right) && !left;",
			].join("\n"),
		});

		expect(messages).not.toContain("avoid conditional execution operators");
	});

	test("allows short-circuit expressions with explicitly boolean calls", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"boolean-calls.ts": [
				"function is_ready(): boolean { return true; }",
				"class State { public is_open(): boolean { return true; } }",
				"const state = new State();",
				"const first = is_ready() || state.is_open();",
			].join("\n"),
		});

		expect(messages).not.toContain("avoid conditional execution operators");
	});

	test("rejects logical assignments and switch-style dispatch", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"dispatch.ts": [
				"let value: string | undefined;",
				"value ??= create_value();",
				"let enabled = false;",
				"enabled ||= is_enabled();",
				"enabled &&= is_enabled();",
				"switch (value) {",
				"  case 'ready':",
				"    create_value();",
				"    break;",
				"}",
			].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid logical assignment operators")).toHaveLength(3);
		expect(messages).toContain("avoid switch statements");
	});
});
