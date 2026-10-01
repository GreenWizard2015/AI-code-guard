import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";
import { PROTOCOL_REFERENCE_FILES } from "tests/core/constants";
describe("coding-lint syntax policy architecture - type contracts", () => {
	test("rejects inline object types used as generic arguments", () => {
		const test_fixture = new TestFixture();

		const messages = test_fixture.violation_messages({
			"generic-inline-types.ts": [
				"type Result = Promise<{ id: string; value: number }>;",
				"type Items = Array<{ id: string }>;",
				"type Wrapped = Promise<({ id: string })>;",
			].join("\n"),
			"generic-inline-types.py": ["def load(items: list[dict[str, int]]) -> None:", "    pass"].join("\n"),
		});
		const test_messages = test_fixture.violation_messages({
			"tests/generic-inline-types_test.py": ["def load(items: list[dict[str, int]]) -> None:", "    pass"].join("\n"),
		});

		expect(messages.filter((message) => message === "avoid inline object types in generic arguments")).toHaveLength(4);
		expect(test_messages).not.toContain("avoid inline object types in generic arguments");
	});

	test("ignores references to interfaces and protocols", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations(PROTOCOL_REFERENCE_FILES);

		expect(violations.some((violation) => violation.message.includes('class "ServicePort"'))).toBe(false);
	});

	test("reports TypeScript field assignments outside constructors", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"mutable.ts": [
				"class Service {",
				"  value = 0;",
				"  constructor() { this.value = 1; }",
				"  update() { this.value = 2; }",
				"}",
			].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "avoid assigning class fields outside constructors",
			}),
		);
	});

	test("reports computed TypeScript field assignments outside constructors", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"mutable-computed.ts": [
				"class Service {",
				"  private value: number = 0;",
				"  update(next: number) {",
				"    this['value'] = next;",
				"    const field_name = 'value';",
				"    this[field_name] = next;",
				"  }",
				"}",
			].join("\n"),
		});

		expect(
			violations.filter((item) => item.message === "avoid assigning class fields outside constructors"),
		).toHaveLength(2);
	});

	test("requires explicit TypeScript member visibility", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"visibility.ts": [
				"class Service {",
				"  value = 0;",
				"  run() { return this.value; }",
				"  private hidden() {}",
				"}",
			].join("\n"),
		});

		expect(
			violations.filter((item) => item.message === "class members must declare visibility explicitly"),
		).toHaveLength(2);
	});

	test("requires explicit visibility on TypeScript accessors", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"accessors.ts": [
				"class Account {",
				'  get name(): string { return "account"; }',
				"  set name(value: string) { void value; }",
				"}",
			].join("\n"),
		});

		expect(
			violations.filter((item) => item.message === "class members must declare visibility explicitly"),
		).toHaveLength(2);
	});

	test("ignores explicit visibility checks in TypeScript tests", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"visibility.test.ts": ["class TestService {", "  value = 0;", "  run() { return this.value; }", "}"].join("\n"),
		});

		expect(violations).not.toContainEqual(
			expect.objectContaining({
				message: "class members must declare visibility explicitly",
			}),
		);
	});

	test("does not require visibility on object literal methods", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"object.ts": ["function create_tools() {", "  return {", "    run() { return true; },", "  };", "}"].join("\n"),
		});

		expect(violations).not.toContainEqual(
			expect.objectContaining({
				message: "class members must declare visibility explicitly",
			}),
		);
	});

	test("reports mutable TypeScript fields as information", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"mutable-fields.ts": ["class Service {", "  public value = 0;", "  public readonly stable = 1;", "}"].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "TypeScript class fields should be readonly",
				priority: 5,
			}),
		);
		expect(violations.filter((item) => item.message === "TypeScript class fields should be readonly")).toHaveLength(1);
	});
});
