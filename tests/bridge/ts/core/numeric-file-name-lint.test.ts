import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint numeric file names", () => {
	test("checks TypeScript source file names", () => {
		const test_fixture = new TestFixture();
		const files = {
			"record8.ts": 'export const value = "ready";',
			"record16.ts": 'export const value = "ready";',
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const numeric_violations = violations.filter((violation) => violation.rule_id() === "numeric-file-name");

		expect(numeric_violations.map((violation) => violation.file())).toEqual(["record8.ts"]);
	});

	test("checks Python source file names", () => {
		const test_fixture = new TestFixture();
		const files = {
			"record24.py": 'value = "ready"\n',
			"record32.py": 'value = "ready"\n',
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const numeric_violations = violations.filter((violation) => violation.rule_id() === "numeric-file-name");

		expect(numeric_violations.map((violation) => violation.file())).toEqual(["record24.py"]);
	});
});
