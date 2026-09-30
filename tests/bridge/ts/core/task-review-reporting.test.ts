import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { describe, expect, test } from "@jest/globals";
import { TaskReviewScenario } from "tests/bridge/ts/core/task-review-scenario";

describe("coding-lint architecture review reporting", () => {
	test("does not inspect review markdown while code problems exist", () => {
		const scenario = new TaskReviewScenario();
		const result = scenario.code_problem_result();
		expect({
			review_request: result.output.includes(
				"ZERO LINT ISSUES IS NOT COMPLETION:",
			),
			code_problem: result.issues.includes("Problem: parse-error message"),
		}).toEqual({ review_request: false, code_problem: true });
	});

	test("prints only total counts when there are no issues", () => {
		const scenario = new TaskReviewScenario();
		const result = scenario.clean_result();
		expect({
			counts: result.output.includes("Total issues: 0.\nTotal files: 0."),
			priority_summary: result.output.includes("1: 0, 2: 0, 3: 0."),
		}).toEqual({ counts: true, priority_summary: false });
	});

	test("prints the philosophy and report path when there are no issues", () => {
		const scenario = new TaskReviewScenario();
		const result = scenario.clean_result();
		const architecture_review = result.output.includes(
			"ZERO LINT ISSUES IS NOT COMPLETION:",
		);
		const function_review = result.output.includes(
			"If any functions.ts, functions.tsx, or functions.py file exists",
		);
		expect({
			philosophy: result.output.includes("## Rule philosophy"),
			architecture_review: architecture_review && function_review,
			report_path: result.output.includes("Report in file `") && result.output.includes("report.md`"),
			report: result.report.includes("| — | 0 | 0 |"),
		}).toEqual({
			philosophy: true,
			architecture_review: true,
			report_path: true,
			report: true,
		});
	});

	test("stops the review request when the exact completion code is in markdown", () => {
		const scenario = new TaskReviewScenario();
		const result = scenario.completed_review();
		expect({
			verified: result.includes(
				"Architecture review completion code verified.",
			),
			request_stopped: !result.includes("ZERO LINT ISSUES IS NOT COMPLETION:"),
			no_markdown_check: !result.includes("too short"),
		}).toEqual({
			verified: true,
			request_stopped: true,
			no_markdown_check: true,
		});
	});

	test("requests details for short review notes", () => {
		const scenario = new TaskReviewScenario();
		const result = scenario.short_review_result();
		expect({
			output: [
				"too short",
				"Add concrete architectural details",
				"Total issues: 2.",
			].every((value) => result.output.includes(value)),
			short_file_exists: result.short_file_exists,
		}).toEqual({ output: true, short_file_exists: true });
	});
});
