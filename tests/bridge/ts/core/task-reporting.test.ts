import "src/bridge/ts/core/context-factory";
import "src/stage-timing";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";
import type { ReportViolation, TaskReportingOptions } from "src/types";
import type { TaskDocuments } from "tests/bridge/ts/core/types";

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
	const documents = (
		prefix: string,
		files: Record<string, string>,
		violations: readonly ReportViolation[],
		options: TaskReportingOptions,
	): TaskDocuments => {
		const fixture = new TestFixture();
		return fixture.with_temporary_files(prefix, files, (root, reporting) => {
			const output = reporting.format(violations, options);
			return {
				output,
				issues: readFileSync(join(root, ".ai-code-guard", "issues.md"), "utf8"),
				report: readFileSync(join(root, ".ai-code-guard", "report.md"), "utf8"),
			};
		});
	};

	test("selects max project priority for files", () => {
		const fixture = new TestFixture();
		const issues = fixture.with_temporary_files("task-reporting-", reporting_files, (_root, reporting) => {
			return reporting.format(reporting_violations, {
				batch_size: 1,
				policy: "top-category",
			});
		});
		expect(issues).toContain("Total files: 1.");
	});

	test("includes every problem in the selected file", () => {
		const result = documents("task-reporting-", reporting_files, reporting_violations, {
			batch_size: 1,
			policy: "top-category",
		});
		expect({
			output: typeof result.output === "string",
			file: result.issues.includes("## "),
			parse_report: result.report.includes("| `parse-error` | 2 | 1 |"),
			parse_problem: result.issues.includes("Problem: parse-error message"),
			class_problem: result.issues.includes("Problem: class-size message"),
			unused_problem: result.issues.includes("Problem: unused-file message"),
			line: result.issues.includes("- Line 1: const first = 1;"),
			class_report: result.report.includes("| `class-size` | 1 | 1 |"),
			unused_report: result.report.includes("| `unused-file` | 1 | 1 |"),
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

	test("shares identical problems and hints across files", () => {
		const document = documents(
			"task-reporting-",
			reporting_files,
			[violation("a.ts", 1, "parse-error", 3), violation("b.ts", 1, "parse-error", 3)],
			{ batch_size: 10, policy: "all" },
		).issues;
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

	test("writes a single problem and hint beside its source line", () => {
		const document = documents("task-reporting-", reporting_files, [violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
		}).issues;
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
		const document = documents(
			"task-reporting-",
			reporting_files,
			[
				{ ...violation("a.ts", 1, "naming", 3), message: "first name", hint: "rename the symbol" },
				{ ...violation("b.ts", 1, "naming", 3), message: "second name", hint: "rename the symbol" },
			],
			{ batch_size: 10, policy: "all" },
		).issues;
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
