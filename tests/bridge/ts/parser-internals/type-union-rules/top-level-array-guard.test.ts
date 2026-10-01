import "src/bridge/ts/parser-internals/type-union-rules/rest-union-contract";
import "src/bridge/ts/parser-internals/type-union-rules/typescript-basic-rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("top-level single-item array state", () => {
	test("rejects a zero-index value followed by an undefined guard", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"array-guard-top-level.ts": [
				"let candidate_items: string[] = [];",
				"const candidate_first = candidate_items[0];",
				"if (candidate_first !== undefined) {",
				"  console.log(candidate_first);",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "single-item-array-state")).toHaveLength(1);
	});

	test("rejects the inverse top-level undefined guard", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"array-guard-top-level-inverse.ts": [
				"let candidate_items: string[] = [];",
				"const candidate_first = candidate_items[0];",
				"if (candidate_first === undefined) {",
				'  console.log("missing");',
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "single-item-array-state")).toHaveLength(1);
	});
});
