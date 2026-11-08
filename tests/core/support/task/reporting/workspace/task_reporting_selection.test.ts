import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { TaskReportingScenario } from "tests/core/support/task/reporting/workspace/task_reporting_scenario";

describe("coding-lint task reporting selection", () => {
	test("all policy includes each file and only its maximum-priority findings", () => {
		const scenario = new TaskReportingScenario();
		const files = {
			"a.ts": "const a = 1;\n",
			"b.ts": "const b = 1;\n",
			"c.ts": "const c = 1;\n",
		};
		const violations = [
			scenario.violation("a.ts", 1, "parse-error", 7),
			scenario.violation("a.ts", 1, "class-size", 7),
			scenario.violation("a.ts", 1, "unused-file", 3),
			scenario.violation("b.ts", 1, "class-size", 7),
			scenario.violation("c.ts", 1, "naming", 3),
		];
		const fixture = scenario.create_fixture(files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format(violations, {
			batch_size: 9999,
			policy: "all",
			skip_review: true,
		});
		const issue_document = fixture.task_text("issues.md");
		const all_files_selected =
			issue_document.includes("/a.ts") && issue_document.includes("/b.ts") && issue_document.includes("/c.ts");
		const lower_priority_problem_in_selected_file = !issue_document.includes("unused-file message");
		const maximum_priority_of_lower_priority_file = issue_document.includes("naming message");
		expect({
			project_totals: output.includes("Total issues: 5.") && output.includes("Total files: 3."),
			all_files_selected,
			lower_priority_problem_in_selected_file,
			maximum_priority_of_lower_priority_file,
		}).toEqual({
			project_totals: true,
			all_files_selected: true,
			lower_priority_problem_in_selected_file: true,
			maximum_priority_of_lower_priority_file: true,
		});
	});

	test("policy changes selected files without changing project totals", () => {
		const scenario = new TaskReportingScenario();
		const files = {
			"a.ts": "const a = 1;\n",
			"b.ts": "const b = 1;\n",
			"c.ts": "const c = 1;\n",
		};
		const violations = [
			scenario.violation("a.ts", 1, "parse-error", 7),
			scenario.violation("a.ts", 1, "parse-error", 7),
			scenario.violation("a.ts", 1, "unused-file", 3),
			scenario.violation("b.ts", 1, "class-size", 7),
			scenario.violation("c.ts", 1, "naming", 3),
		];
		const fixture = scenario.create_fixture(files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const top_category_output = reporting.format(violations, {
			batch_size: 9999,
			policy: "top-category",
			skip_review: true,
		});
		const top_category_issues = fixture.task_text("issues.md");
		const all_output = reporting.format(violations, {
			batch_size: 9999,
			policy: "all",
			skip_review: true,
		});
		const all_issues = fixture.task_text("issues.md");
		const all_report = fixture.task_text("report.md");

		expect({
			top_category_totals:
				top_category_output.includes("Total issues: 5.") && top_category_output.includes("Total files: 3."),
			all_totals: all_output.includes("Total issues: 5.") && all_output.includes("Total files: 3."),
			top_category_files: top_category_issues.includes("/a.ts") && !top_category_issues.includes("/b.ts"),
			all_files_selected: all_issues.includes("/a.ts") && all_issues.includes("/b.ts") && all_issues.includes("/c.ts"),
			all_includes_only_each_files_maximum:
				!all_issues.includes("unused-file message") && all_issues.includes("naming message"),
			lower_priority_is_deferred: all_report.includes("`a.ts:1` (priority 3, unused-file): unused-file message"),
		}).toEqual({
			top_category_totals: true,
			all_totals: true,
			top_category_files: true,
			all_files_selected: true,
			all_includes_only_each_files_maximum: true,
			lower_priority_is_deferred: true,
		});
	});

	test("top-category selects files using the largest rule group at project max priority", () => {
		const scenario = new TaskReportingScenario();
		const files = {
			"a.ts": "const a = 1;\n",
			"b.ts": "const b = 1;\n",
		};
		const violations = [
			scenario.violation("a.ts", 1, "class-size", 7),
			scenario.violation("b.ts", 1, "parse-error", 7),
			scenario.violation("b.ts", 1, "parse-error", 7),
			scenario.violation("b.ts", 1, "unused-file", 3),
		];
		const fixture = scenario.create_fixture(files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format(violations, {
			batch_size: 1,
			policy: "top-category",
			skip_review: true,
		});
		const issue_document = fixture.task_text("issues.md");
		expect({
			dominant_group_file_selected: issue_document.includes("/b.ts"),
			other_max_priority_file_excluded: !issue_document.includes("/a.ts"),
			all_problems_in_selected_file: issue_document.includes("unused-file message"),
		}).toEqual({
			dominant_group_file_selected: true,
			other_max_priority_file_excluded: true,
			all_problems_in_selected_file: true,
		});
	});
});
