import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript imported class fields", () => {
	test("reports imported functions assigned to top-level class fields", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"helper.ts": "export function execute(): number { return 1; }",
			"service.ts": ["import { execute } from './helper';", "class Service { public run = execute; }"].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(1);
	});

	test("reports imported functions assigned to nested class fields", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"helper.ts": "export function execute(): number { return 1; }",
			"service.ts": [
				"import { execute } from './helper';",
				"function build(): void {",
				"  class Service { public run = execute; }",
				"  void Service;",
				"}",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(1);
	});

	test("reports imported functions assigned to class expressions", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"helper.ts": "export function execute(): number { return 1; }",
			"service.ts": ["import { execute } from './helper';", "const Service = class { public run = execute; };"].join(
				"\n",
			),
		});

		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(1);
	});

	test("reports imported functions assigned to nested Python class fields", () => {
		const fixture = new TestFixture();
		const violations = fixture.collect_fixture_violations({
			"helper.py": "def execute():\n    return 1\n",
			"service.py": [
				"from .helper import execute",
				"",
				"def build():",
				"    class Candidate:",
				"        run = execute",
				"    return Candidate",
			].join("\n"),
		});

		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(1);
	});
});
