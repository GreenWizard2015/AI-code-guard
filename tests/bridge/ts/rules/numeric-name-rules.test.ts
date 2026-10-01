import "src/bridge/ts/rules/class-rules";
import "src/bridge/ts/rules/naming-validation";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint numeric name rule", () => {
	test("rejects numbers in TypeScript names including local symbols", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"source.ts": [
				"type Data2 = string;",
				"class Service2 {",
				"  field2: string;",
				"  method2(parameter2: string): string {",
				"    const local2 = parameter2;",
				"    return local2;",
				"  }",
				"}",
			].join("\n"),
		});

		const numeric_violations = violations.filter((violation) => violation.rule_id === "numeric-name");
		expect({
			count: numeric_violations.length,
			messages: numeric_violations.every((violation) => violation.message === "symbol names must not contain numbers"),
		}).toEqual({ count: 6, messages: true });
	});

	test("rejects numbers in Python names including local symbols", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"source.py": [
				"Data2 = dict[str, str]",
				"class Contract2:",
				"    field3: str",
				"",
				"class Service2:",
				"    field2: str",
				"    def method2(self, parameter2: str) -> str:",
				"        local2 = parameter2",
				"        return local2",
			].join("\n"),
		});

		const numeric_violations = violations.filter((violation) => violation.rule_id === "numeric-name");
		expect({
			count: numeric_violations.length,
			messages: numeric_violations.every((violation) => violation.message === "symbol names must not contain numbers"),
		}).toEqual({ count: 8, messages: true });
	});
});
