import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { ViolationValue } from "src/model/violation_value";
import { TaskReportingScenario } from "tests/core/support/task/reporting/workspace/task_reporting_scenario";

describe("coding-lint task issue documents", () => {
	test("shares each identical problem and hint once", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture(scenario.reporting_files());
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format(
			[scenario.violation("a.ts", 1, "parse-error", 3), scenario.violation("b.ts", 1, "parse-error", 3)],
			{
				batch_size: 10,
				policy: "all",
				skip_review: false,
			},
		);
		const document = scenario.documents(fixture, output).issues;
		const problem_matches = document.match(/Problem: parse-error message/gu);
		const hint_matches = document.match(/Hint: parse-error hint/gu);
		let problem_count = 0;
		let hint_count = 0;
		if (problem_matches !== null) {
			problem_count = problem_matches.length;
		}
		if (hint_matches !== null) {
			hint_count = hint_matches.length;
		}
		expect({ problem_count, hint_count }).toEqual({ problem_count: 1, hint_count: 1 });
	});

	test("keeps file sections and source-line entries for both files", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture(scenario.reporting_files());
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format(
			[scenario.violation("a.ts", 1, "parse-error", 3), scenario.violation("b.ts", 1, "parse-error", 3)],
			{ batch_size: 10, policy: "all", skip_review: false },
		);
		const document = scenario.documents(fixture, output).issues;
		expect({
			first_file: document.includes("/a.ts"),
			second_file: document.includes("/b.ts"),
		}).toEqual({
			first_file: true,
			second_file: true,
		});
	});

	test("prints each source line for matching diagnostics", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture(scenario.reporting_files());
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const violations = [
			scenario.violation("a.ts", 1, "parse-error", 3),
			scenario.violation("b.ts", 1, "parse-error", 3),
		];
		const output = reporting.format(violations, { batch_size: 10, policy: "all", skip_review: false });
		const document = scenario.documents(fixture, output).issues;
		const line_count = document.split("- Line 1:").length - 1;

		expect(line_count).toBe(2);
	});

	test("keeps every correction hint inside its owning file section", () => {
		const files = {
			"a.ts": "const alpha = 1;\n",
			"b.ts": "const beta = 2;\n",
		};
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture(files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format(
			[
				new ViolationValue({
					file: "a.ts",
					line: 1,
					message: "rename alpha",
					hint: "alpha correction",
					rule_id: "naming",
					priority: 3,
				}),
				new ViolationValue({
					file: "b.ts",
					line: 1,
					message: "rename beta",
					hint: "beta correction",
					rule_id: "naming",
					priority: 3,
				}),
			],
			{ batch_size: 10, policy: "all", skip_review: false },
		);
		const document = scenario.documents(fixture, output).issues;
		const alpha_file = document.indexOf("/a.ts");
		const beta_file = document.indexOf("/b.ts");
		const alpha_start = document.lastIndexOf("## ", alpha_file);
		const beta_start = document.lastIndexOf("## ", beta_file);
		const alpha_section = document.slice(alpha_start, beta_start);
		const beta_section = document.slice(beta_start);
		expect({
			alpha_message: alpha_section.includes("rename alpha"),
			alpha_hint: alpha_section.includes("alpha correction"),
			alpha_without_beta_hint: !alpha_section.includes("beta correction"),
			beta_message: beta_section.includes("rename beta"),
			beta_hint: beta_section.includes("beta correction"),
			beta_without_alpha_hint: !beta_section.includes("alpha correction"),
		}).toEqual({
			alpha_message: true,
			alpha_hint: true,
			alpha_without_beta_hint: true,
			beta_message: true,
			beta_hint: true,
			beta_without_alpha_hint: true,
		});
	});

	test("writes a single problem and hint beside its source line", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture(scenario.reporting_files());
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format([scenario.violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const document = scenario.documents(fixture, output).issues;
		const file_section = document.indexOf("## ");
		const source_line = document.indexOf("- Line 1: const first = 1;");
		expect({
			description_problem: document.indexOf("Problem: parse-error message") < file_section,
			description_hint: document.indexOf("Hint: parse-error hint") < file_section,
			line_problem: document.indexOf("Problem: parse-error message") > source_line,
			line_hint: document.indexOf("Hint: parse-error hint") > source_line,
		}).toEqual({
			description_problem: false,
			description_hint: false,
			line_problem: true,
			line_hint: true,
		});
	});

	test("keeps unique problems and writes a shared hint once", () => {
		const scenario = new TaskReportingScenario();
		const fixture = scenario.create_fixture(scenario.reporting_files());
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format(
			[
				new ViolationValue({
					file: "a.ts",
					line: 1,
					message: "first name",
					hint: "rename the symbol",
					rule_id: "naming",
					priority: 3,
				}),
				new ViolationValue({
					file: "b.ts",
					line: 1,
					message: "second name",
					hint: "rename the symbol",
					rule_id: "naming",
					priority: 3,
				}),
			],
			{ batch_size: 10, policy: "all", skip_review: false },
		);
		const document = scenario.documents(fixture, output).issues;
		expect({
			description: document.includes("Description:"),
			first_problem: document.split("Problem: first name").length - 1,
			second_problem: document.split("Problem: second name").length - 1,
			shared_hint: document.split("Hint: rename the symbol").length - 1,
		}).toEqual({
			description: false,
			first_problem: 1,
			second_problem: 1,
			shared_hint: 1,
		});
	});
});
