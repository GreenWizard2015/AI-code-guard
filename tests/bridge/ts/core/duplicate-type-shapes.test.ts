import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint duplicate type shapes", () => {
	test("reports duplicate top-level type shapes", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"types.ts": [
				"type Left = { value: string; label: string };",
				"type Right = { value: string; label: string };",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "duplicate-type-shape")).toHaveLength(1);
	});

	test("reports duplicate type shapes nested in namespaces", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"types.ts": [
				"namespace ValueTypes {",
				"  export type Left = { value: string; label: string };",
				"  export type Right = { value: string; label: string };",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "duplicate-type-shape")).toHaveLength(1);
	});

	test("reports duplicate interfaces nested in namespaces", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"types.ts": [
				"namespace ValueTypes {",
				"  export interface Left { value: string; label: string; }",
				"  export interface Right { value: string; label: string; }",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "duplicate-type-shape")).toHaveLength(1);
	});
});
