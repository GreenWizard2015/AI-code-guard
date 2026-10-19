import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript imported class fields", () => {
	test("reports imported functions assigned to top-level class fields", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"helper.ts": "export function execute(): number { return 1; }",
				"service.ts": ["import { execute } from './helper';", "class Service { public run = execute; }"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(1);
	});

	test("keeps declaration modules independent across barrel exports", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": "export function first(): number { return 1; }",
				"second.ts": "export function second(): number { return 2; }",
				"barrel.ts": ["export { first } from './first';", "export { second } from './second';"].join("\n"),
				"service.ts": ["import { first, second } from './barrel';", "class Service { public run = second; }"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(1);
	});

	test("reports imported functions assigned to nested class fields", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"helper.ts": "export function execute(): number { return 1; }",
				"service.ts": [
					"import { execute } from './helper';",
					"function build(): void {",
					"  class Service { public run = execute; }",
					"  void Service;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(1);
	});

	test("reports imported functions assigned to class expressions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"helper.ts": "export function execute(): number { return 1; }",
				"service.ts": ["import { execute } from './helper';", "const Service = class { public run = execute; };"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(1);
	});

	test("reports imported functions assigned to nested Python class fields", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"helper.py": "def execute():\n    return 1\n",
				"service.py": [
					"from .helper import execute",
					"",
					"def build():",
					"    class Candidate:",
					"        run = execute",
					"    return Candidate",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(1);
	});

	test("resolves imported Python class fields across multiple project files", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"helper.py": "def execute():\n    return 1\n",
				"first.py": "from .helper import execute\nclass First:\n    run = execute\n",
				"second.py": "from .helper import execute\nclass Second:\n    run = execute\n",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "class-field-import")).toHaveLength(2);
	});
});
