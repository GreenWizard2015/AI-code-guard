import "src/bridge/ts/parser-internals/type-union-rules/rest-union-contract";
import "src/bridge/ts/parser-internals/type-union-rules/typescript-basic-rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("generic TypeScript type boundaries", () => {
	test("rejects composite unions nested in generic parameters", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"generic-parameter.ts": [
				'type ControlA = { state: "a" };',
				'type ControlB = { state: "b" };',
				"function read(value: Promise<ControlA | ControlB>): void {}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "composite-state-type")).toHaveLength(1);
	});

	test("rejects composite unions nested in generic properties", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"generic-property.ts": [
				'type ControlA = { state: "a" };',
				'type ControlB = { state: "b" };',
				"interface State { value: Array<ControlA | ControlB>; }",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "composite-state-type")).toHaveLength(1);
	});

	test("allows primitive unions nested in generic parameters", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"generic-primitive.ts": "function read(value: Promise<string | number>): void {}",
		});

		expect(violations.filter((item) => item.rule_id === "composite-state-type")).toHaveLength(0);
	});
});
