import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint syntax policy control flow - object values", () => {
	test("rejects namespace-shaped objects with multiple callable fields", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"fake-object.ts": [
				"export const CHAT_INPUT_TOOLS = {",
				"  getComposerInput: (input: HTMLElement) => input,",
				"  getComposerInputOrNull: (input: HTMLElement) => input,",
				"  isComposerEmpty: (input: HTMLElement) => !input.textContent,",
				"};",
				"const CONFIG = { timeoutMs: 1000, enabled: true };",
			].join("\n"),
		});

		expect(messages).toContain("avoid object literals that imitate classes");
	});

	test("rejects class-like objects with one method even when not exported", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"parser.ts": [
				"const AGENT_PARSER = {",
				"  raise_task_error(payload: unknown): void { throw new Error(String(payload)); },",
				"};",
			].join("\n"),
		});

		expect(messages).toContain("avoid object literals that imitate classes");
	});

	test("rejects callable object literals regardless of variable name", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"callable-object.ts": [
				"const run = () => {};",
				"const value = {",
				"  run(input: string) { return input; },",
				"};",
				"const aliased = { run };",
				"const wrapped = { run: (function () {}) };",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-fake-object")).toHaveLength(3);
	});

	test("rejects object literals with accessor fields", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"accessor-object.ts": ["const state = {", '  get name(): string { return "value"; },', "};"].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-fake-object")).toHaveLength(1);
	});

	test("does not report callable test doubles", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"tests/callable-object.test.ts": ["const value = {", "  run(input: string) { return input; },", "};"].join("\n"),
		});

		expect(messages).not.toContain("avoid object literals that imitate classes");
	});

	test("rejects callable options passed as an argument", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"callable-options.ts": ["configure({", "  onStart() {},", "});"].join("\n"),
		});

		expect(messages).toContain("avoid object literals that imitate classes");
	});

	test("rejects Object.assign through aliases", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"object-assign-alias.ts": [
				"const source = { value: 1 };",
				"const target = {};",
				"const object_alias = Object;",
				"const second_alias = object_alias;",
				"second_alias.assign(target, source);",
				"const { assign: assign_alias } = Object;",
				"assign_alias(target, source);",
				'const method_name = "assign";',
				"Object[method_name](target, source);",
			].join("\n"),
		});

		expect(messages).toContain("avoid Object.assign");
	});

	test("rejects Object prototype calls through aliases", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"object-prototype-alias.ts": [
				"const value = {};",
				"const object_alias = Object;",
				"object_alias.prototype.toString.call(value);",
				"object_alias.prototype.hasOwnProperty.call(value, 'value');",
				'Object["prototype"]["toString"]["call"](value);',
			].join("\n"),
		});

		expect(messages).toContain("avoid Object.prototype.toString.call");
		expect(messages).toContain("avoid Object method .call");
	});
});
