import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("coding-lint Python callable boundaries", () => {
	test("requires return types on nested Python functions", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"nested-callable.py": [
				"def control(value: str) -> str:",
				"\treturn value",
				"",
				"def outer() -> str:",
				"\tdef candidate(value: str):",
				"\t\treturn value",
				'\treturn candidate("value")',
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "explicit-return-type")).toEqual([
			expect.objectContaining({ line: 5 }),
		]);
	});

	test("requires return types on nested async Python functions", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"nested-async-callable.py": [
				"def outer() -> str:",
				"\tasync def candidate(value: str):",
				"\t\treturn value",
				'\treturn "value"',
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "explicit-return-type")).toEqual([
			expect.objectContaining({ line: 2 }),
		]);
	});
});
