import "src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/typescript-module-declaration-naming";
import "src/bridge/ts/rules/naming-validation";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";

describe("TypeScript module declaration naming", () => {
	test("requires uppercase constants and forbids module variables", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"source.ts": [
				"const VALID_NAME = 1;",
				"const invalid_name = 2;",
				"export const exported_name = 3;",
				"let mutable_name = 4;",
				"export var exported_mutable_name = 5;",
				"function local_state() { const local_name = 6; return local_name; }",
			].join("\n"),
		});

		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					rule_id: "typescript-module-constant-case",
					message: 'module-level constant "invalid_name" must use UPPER_SNAKE_CASE',
				}),
				expect.objectContaining({
					rule_id: "typescript-module-constant-case",
					message: 'module-level constant "exported_name" must use UPPER_SNAKE_CASE',
				}),
				expect.objectContaining({
					rule_id: "typescript-module-variable",
					message: 'module-level variable "mutable_name" is not allowed',
				}),
				expect.objectContaining({
					rule_id: "typescript-module-variable",
					message: 'module-level variable "exported_mutable_name" is not allowed',
				}),
			]),
		);
		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					rule_id: "typescript-module-constant-case",
					message: expect.stringContaining('"VALID_NAME"'),
				}),
				expect.objectContaining({
					rule_id: "typescript-module-variable",
					message: expect.stringContaining('"local_name"'),
				}),
			]),
		);
	});

	test("allows uppercase module constants and local mutable state", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.collect_fixture_violations({
			"source.ts": [
				"export const VALID_NAME = 1;",
				"function local_state() { let local_name = 2; return local_name; }",
			].join("\n"),
		});

		expect(
			violations.filter(
				(violation) =>
					violation.rule_id === "typescript-module-constant-case" || violation.rule_id === "typescript-module-variable",
			),
		).toEqual([]);
	});
});
