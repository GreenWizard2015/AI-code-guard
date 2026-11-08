import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { TaskReportingScenario } from "tests/core/support/task/reporting/workspace/task_reporting_scenario";

describe("coding-lint task reporting totals", () => {
	test("reports all diagnostics while selecting task files by project priority", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture(scenario.reporting_files());
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const issues = reporting.format(scenario.reporting_violations(), {
			batch_size: 1,
			policy: "top-category",
			skip_review: false,
		});
		expect({
			all_issues: issues.includes("Total issues: 6."),
			all_files: issues.includes("Total files: 2."),
		}).toEqual({ all_issues: true, all_files: true });
	});

	test("includes every problem in the selected file", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture(scenario.reporting_files());
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format(scenario.reporting_violations(), {
			batch_size: 1,
			policy: "top-category",
			skip_review: false,
		});
		const result = scenario.documents(fixture, output);
		expect({
			output: typeof result.output === "string",
			file: result.issues.includes("## "),
			parse_report: result.report.includes("| `parse-error[typescript]` | 2 | 1 |"),
			parse_problem: result.issues.includes("Problem: parse-error message"),
			class_problem: result.issues.includes("Problem: class-size message"),
			unused_problem: result.issues.includes("Problem: unused-file message"),
			line: result.issues.includes("- Line 1: const first = 1;"),
			class_report: result.report.includes("| `class-size[typescript]` | 1 | 1 |"),
			unused_report: result.report.includes("| `unused-file[typescript]` | 1 | 1 |"),
		}).toEqual({
			output: true,
			file: true,
			parse_report: true,
			parse_problem: true,
			class_problem: true,
			unused_problem: true,
			line: true,
			class_report: true,
			unused_report: true,
		});
	});

	test("skips the architecture review gate when requested", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture({});
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: true });
		expect({
			counts: output.includes("Total issues: 0.\nTotal files: 0."),
			instruction: !output.includes("architecture-review-prompt.md"),
			report: output.includes("Report in file"),
		}).toEqual({ counts: true, instruction: true, report: true });
	});
});
