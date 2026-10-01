import "src/bridge/ts/rules/class-rules";
import "src/bridge/ts/rules/naming-validation";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint nested type declarations", () => {
	test("rejects aliases, interfaces, and enums in every nested scope", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"nested-types.ts": [
				"namespace Scope {",
				"\texport type NestedAlias = string;",
				"\texport interface NestedInterface { run(): void; }",
				"\texport enum NestedEnum { Ready }",
				"}",
				"function create(): string {",
				"\ttype FunctionAlias = string;",
				'\treturn "value";',
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "nested-type")).toEqual([
			expect.objectContaining({ priority: 8 }),
		]);
	});

	test("gives nested type violations higher priority than type checks", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"nested-type-priority.ts": ["function create(): unknown {", "\ttype LocalValue = any;", "\treturn {};", "}"].join(
				"\n",
			),
		});
		const nested = violations.find((item) => item.rule_id === "nested-type");
		const unbounded = violations.find((item) => item.rule_id === "unbounded-type");

		expect(nested?.priority).toBe(8);
		expect(unbounded?.priority).toBe(5);
	});

	test("rejects nested Python type aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"nested-types.py": [
				"from typing import TypeAlias",
				"",
				"def create():",
				"    LocalValue: TypeAlias = str",
				'    return "value"',
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "nested-type")).toEqual([
			expect.objectContaining({ priority: 8 }),
		]);
	});
});
