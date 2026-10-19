import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task_reporting";
import type { ReportViolation } from "src/types";
import type { TaskDocuments } from "tests/bridge/ts/core/types";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";

describe("coding-lint task reporting", () => {
	/** Responsibilities: _construction task-reporting violation fixture_. **/
	const violation = (
		file: string,
		line: number,
		rule_id: string,
		priority: ReportViolation["priority"],
	): ReportViolation => ({
		file,
		line,
		message: `${rule_id} message`,
		hint: `${rule_id} hint`,
		rule_id,
		priority,
	});
	const reporting_files = {
		"a.ts": "const first = 1;\nconst second = 2;\nconst third = 3;\n",
		"b.ts": "const first = 1;\n",
	};
	const reporting_violations = [
		violation("a.ts", 1, "parse-error", 3),
		violation("a.ts", 2, "parse-error", 3),
		violation("a.ts", 3, "class-size", 3),
		violation("a.ts", 1, "unused-file", 2),
		violation("b.ts", 1, "parse-error", 3),
		violation("b.ts", 1, "unused-file", 2),
	];
	/** Responsibilities: _task document formatting_. **/
	const documents = (fixture: TaskReportingMemoryWorkspace, output: string): TaskDocuments => {
		return {
			output,
			issues: fixture.task_text("issues.md"),
			report: fixture.task_text("report.md"),
		};
	};

	test("reports all diagnostics while selecting task files by project priority", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const issues = reporting.format(reporting_violations, {
			batch_size: 1,
			policy: "top-category",
			skip_review: false,
		});
		expect({
			all_issues: issues.includes("Total issues: 6."),
			all_files: issues.includes("Total files: 2."),
		}).toEqual({ all_issues: true, all_files: true });
	});

	test("keeps open review findings in results when review is skipped", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		fixture.file_io.file_content.write_text(
			fixture.task_path("review/review-boundaries-open.md"),
			"# Open review\n\nConfirmed architectural defect.\n",
		);
		const output = reporting.format([], { batch_size: 10, policy: "all", skip_review: true });
		expect(output).toContain("Confirmed architectural defect.");
	});

	test("includes every problem in the selected file", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const output = reporting.format(reporting_violations, {
			batch_size: 1,
			policy: "top-category",
			skip_review: false,
		});
		const result = documents(fixture, output);
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

	test("all policy includes every max-priority file and every problem in those files", () => {
		const files = {
			"a.ts": "const a = 1;\n",
			"b.ts": "const b = 1;\n",
			"c.ts": "const c = 1;\n",
		};
		const violations = [
			violation("a.ts", 1, "parse-error", 7),
			violation("a.ts", 1, "class-size", 7),
			violation("a.ts", 1, "unused-file", 3),
			violation("b.ts", 1, "class-size", 7),
			violation("c.ts", 1, "naming", 3),
		];
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const output = reporting.format(violations, {
			batch_size: 9999,
			policy: "all",
			skip_review: true,
		});
		const issue_document = fixture.task_text("issues.md");
		expect({
			project_totals: output.includes("Total issues: 5.") && output.includes("Total files: 3."),
			selected_max_priority_files: issue_document.includes("/a.ts") && issue_document.includes("/b.ts"),
			lower_priority_problem_in_selected_file: issue_document.includes("unused-file message"),
			lower_priority_only_file_excluded: !issue_document.includes("/c.ts"),
		}).toEqual({
			project_totals: true,
			selected_max_priority_files: true,
			lower_priority_problem_in_selected_file: true,
			lower_priority_only_file_excluded: true,
		});
	});

	test("policy changes selected files without changing project totals", () => {
		const files = {
			"a.ts": "const a = 1;\n",
			"b.ts": "const b = 1;\n",
			"c.ts": "const c = 1;\n",
		};
		const violations = [
			violation("a.ts", 1, "parse-error", 7),
			violation("a.ts", 1, "parse-error", 7),
			violation("a.ts", 1, "unused-file", 3),
			violation("b.ts", 1, "class-size", 7),
			violation("c.ts", 1, "naming", 3),
		];
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
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

		expect({
			top_category_totals:
				top_category_output.includes("Total issues: 5.") && top_category_output.includes("Total files: 3."),
			all_totals: all_output.includes("Total issues: 5.") && all_output.includes("Total files: 3."),
			top_category_files: top_category_issues.includes("/a.ts") && !top_category_issues.includes("/b.ts"),
			all_max_priority_files: all_issues.includes("/a.ts") && all_issues.includes("/b.ts"),
			all_includes_every_problem_in_selected_files:
				all_issues.includes("unused-file message") && !all_issues.includes("naming message"),
		}).toEqual({
			top_category_totals: true,
			all_totals: true,
			top_category_files: true,
			all_max_priority_files: true,
			all_includes_every_problem_in_selected_files: true,
		});
	});

	test("top-category selects files using the largest rule group at project max priority", () => {
		const files = {
			"a.ts": "const a = 1;\n",
			"b.ts": "const b = 1;\n",
		};
		const violations = [
			violation("a.ts", 1, "class-size", 7),
			violation("b.ts", 1, "parse-error", 7),
			violation("b.ts", 1, "parse-error", 7),
			violation("b.ts", 1, "unused-file", 3),
		];
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
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

	test("shares identical problems and hints across files", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const output = reporting.format([violation("a.ts", 1, "parse-error", 3), violation("b.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const document = documents(fixture, output).issues;
		expect({
			problem_count: document.match(/Problem: parse-error message/gu)?.length,
			hint_count: document.match(/Hint: parse-error hint/gu)?.length,
			first_file: document.match(/## .*a\.ts/gu)?.length,
			second_file: document.match(/## .*b\.ts/gu)?.length,
			all_lines: document.match(/- Line 1:/gu)?.length,
		}).toEqual({
			problem_count: 1,
			hint_count: 1,
			first_file: 1,
			second_file: 1,
			all_lines: 2,
		});
	});

	test("keeps every correction hint inside its owning file section", () => {
		const files = {
			"a.ts": "const alpha = 1;\n",
			"b.ts": "const beta = 2;\n",
		};
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const output = reporting.format(
			[
				{ ...violation("a.ts", 1, "naming", 3), message: "rename alpha", hint: "alpha correction" },
				{ ...violation("b.ts", 1, "naming", 3), message: "rename beta", hint: "beta correction" },
			],
			{ batch_size: 10, policy: "all", skip_review: false },
		);
		const document = documents(fixture, output).issues;
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
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const output = reporting.format([violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const document = documents(fixture, output).issues;
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
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const output = reporting.format(
			[
				{ ...violation("a.ts", 1, "naming", 3), message: "first name", hint: "rename the symbol" },
				{ ...violation("b.ts", 1, "naming", 3), message: "second name", hint: "rename the symbol" },
			],
			{ batch_size: 10, policy: "all", skip_review: false },
		);
		const document = documents(fixture, output).issues;
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

	test("skips the architecture review gate when requested", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: true });
		expect({
			counts: output.includes("Total issues: 0.\nTotal files: 0."),
			instruction: !output.includes("architecture-review-prompt.md"),
			report: output.includes("Report in file"),
		}).toEqual({ counts: true, instruction: true, report: true });
	});
});
