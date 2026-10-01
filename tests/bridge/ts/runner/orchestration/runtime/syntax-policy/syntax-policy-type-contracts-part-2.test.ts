import "src/bridge/ts/runner/orchestration/runtime/file-lint";
import "src/bridge/ts/runner/orchestration/runtime/coding-rules";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";
describe("coding-lint syntax policy architecture - type contracts", () => {
	test("reports optional singular/plural fields that may contain aliases", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"ast-types.ts": "type AstClassNode = { base_class_name?: string; base_class_names?: string[]; };",
		});
		expect(violations.filter((item) => item.rule_id === "typescript-singular-plural-alias")).toEqual([
			expect.objectContaining({ message: "optional singular/plural fields may be aliases", priority: 5 }),
			expect.objectContaining({ message: "optional singular/plural fields may be aliases", priority: 5 }),
		]);
	});

	test("limits TypeScript type fields to ten", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"too-many-fields.ts": [
				"type LargeType = {",
				...Array.from({ length: 11 }, (_, index) => `  field_${index}: string;`),
				"};",
			].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "type-field-count",
				message: "type has too many fields (found 11)",
			}),
		);
	});

	test("limits Python type contract fields to ten", () => {
		const test_fixture = new TestFixture();
		const fields = Array.from({ length: 11 }, (_, index) => `    field_${index}: str`);
		const violations = test_fixture.collect_fixture_violations({
			"too-many-fields.py": ["class LargeType:", ...fields].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "type-field-count",
				message: "type has too many fields (found 11)",
			}),
		);
	});

	test("requires named types for inline literal unions in fields", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"inline-union-field.ts": "type AstCallableReference = { kind: 'function' | 'method'; };",
		});

		expect(violations.filter((item) => item.rule_id === "typescript-inline-union-type")).toHaveLength(1);
	});

	test("rejects arrays used as nullable state", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"array-state.ts": [
				"type Service = { value: string };",
				"function find_service(): Service[] { return []; }",
				"const service = find_service()[1];",
				"const at_service = find_service().at(0);",
			].join("\n"),
		});

		expect(violations).toContainEqual(expect.objectContaining({ rule_id: "single-item-array-state" }));
	});

	test("reports optional fields with named types", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"types.ts": [
				"export type AstStatementNode = {",
				"  kind: AstStatementKind;",
				"  line: number;",
				"  name?: string;",
				"  value_name?: string;",
				"  simple_alias?: boolean;",
				"  destructured?: boolean;",
				"};",
			].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "nullable-domain-type",
				line: 4,
			}),
		);
	});

	test("rejects base-or-intersection unions that hide required contract fields", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"report.ts": [
				"type ReportViolationBase = { file: string; line: number; };",
				"type ReportViolation =",
				"  | ReportViolationBase",
				"  | (ReportViolationBase & {",
				"    readonly rule_id: string;",
				"    readonly priority: ViolationPriority;",
				"  });",
			].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({ rule_id: "typescript-union-contract-bypass", priority: 6 }),
		);
	});

	test("rejects qualified base-or-intersection unions", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"qualified-union.ts": [
				"namespace ModelTypes {",
				"  export type Node = { file: string; };",
				"}",
				"type Candidate = ModelTypes.Node | (ModelTypes.Node & { line: number; });",
			].join("\n"),
		});

		expect(violations).toContainEqual(expect.objectContaining({ rule_id: "typescript-union-contract-bypass" }));
	});

	test("requires classes for discriminated state unions", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"result.ts": [
				"type UserLookup =",
				"  | { state: 'found'; user: User }",
				"  | { state: 'not-found'; reason: string };",
			].join("\n"),
		});

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "composite-state-type",
				priority: 6,
			}),
		);
	});
});
