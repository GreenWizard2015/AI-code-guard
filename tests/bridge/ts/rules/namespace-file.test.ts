import "src/bridge/ts/rules/class-rules";
import "src/bridge/ts/rules/naming-validation";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript namespace file rules", () => {
	test("allows imports and one namespace only", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"valid-namespace.ts": [
				"import { value } from './value';",
				"namespace Scope {",
				"\texport const result = value;",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-namespace-file")).toHaveLength(0);
	});

	test("rejects multiple namespaces and code outside the namespace", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"invalid-namespace.ts": ["namespace First {}", "namespace Second {}", "const outside = 1;"].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "typescript-namespace-file")).toHaveLength(1);
	});

	test("applies ordinary TypeScript rules inside the namespace", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.collect_fixture_violations({
			"namespace-content.ts": [
				"namespace Scope {",
				"\texport function read(value: unknown): any {",
				"\t\treturn value;",
				"\t}",
				"}",
			].join("\n"),
		});

		expect(violations.some((item) => item.rule_id === "type-info")).toBe(true);
		expect(violations.some((item) => item.rule_id === "typescript-unknown-parameter-type")).toBe(true);
	});
});
