import { describe, expect, test } from "@jest/globals";
import { CliResultReporter } from "src/core/support/cli_result_reporter";
import { PerformanceReport } from "src/core/support/performance_report";
import { TaskReporting } from "src/core/support/task_reporting";
import type { ReportViolation } from "src/types";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import { LintStageTimer } from "src/lint_stage_timer";
import { RULE_DOCUMENT_PATHS_BY_ID } from "src/constants";

describe("coding-lint task reporting summaries", () => {
	const fixture_factory = new TaskReportingMemoryFixture();
	/** Responsibilities: _summary violation construction_. **/
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

	test("reports priority zero diagnostics as problems", () => {
		const fixture = fixture_factory.create({ "a.ts": "const first = 1;\n" });
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		reporting.format([violation("a.ts", 1, "responsibilities-wording", 0)], {
			batch_size: 10,
			policy: "top-category",
			skip_review: false,
		});
		expect(fixture.task_text("report.md")).toContain("| `responsibilities-wording[typescript]` | 1 | 1 |");
	});

	test("reports the ten most frequent rules and aggregates the rest", () => {
		const fixture = fixture_factory.create({ "a.ts": "const first = 1;\n" });
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const all_rule_ids = [...RULE_DOCUMENT_PATHS_BY_ID.keys()];
		const rule_ids = all_rule_ids.slice(0, 12);
		const violations = rule_ids.map((rule_id, index) => violation(`file-${index}.ts`, index + 1, rule_id, 2));
		reporting.format(violations, { batch_size: 20, policy: "all", skip_review: true });
		const report = fixture.task_text("report.md");
		const visible_rule_rows = report.match(/^\| `/gmu);
		let visible_rule_count = 0;
		if (visible_rule_rows !== null) {
			visible_rule_count = visible_rule_rows.length;
		}
		expect({
			visible_rule_count,
			first_omitted: report.includes(`\`${rule_ids[10]}\``),
			aggregated_row: report.includes("| Others | 2 | 2 |"),
		}).toEqual({ visible_rule_count: 10, first_omitted: false, aggregated_row: true });
	});

	test("writes the complete lint output to Markdown", () => {
		const fixture = fixture_factory.create({ "a.ts": "const first = 1;\n" });
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		reporting.documents.write_document("lint-output", "Total issues: 1.");
		expect(fixture.task_text("lint-output.md")).toBe("Total issues: 1.\n");
	});

	test("captures CLI diagnostics and performance output", () => {
		const fixture = fixture_factory.create({ "a.ts": "const first = 1;\n" });
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const reporter = new CliResultReporter(
			{
				format: () => {
					reporting.documents.write_document("lint-output", "lint output");
					return "lint output";
				},
			},
			reporting.documents,
		);
		const report = { files: [], violations: [] };
		const options = {
			root: fixture.root,
			ignored_directories: [],
			entry_files: [],
			skip_review: false,
			force_review: false,
			review_cleanup: false,
			review_agent: "none" as const,
			review_stages: [],
			batch_size: 10,
			policy: "all" as const,
		};
		reporter.report(report, options);
		reporter.report_performance(report, options, new LintStageTimer());
		const result = {
			lint_output: fixture.task_text("lint-output.md"),
			performance: fixture.task_text("performance.md"),
		};
		expect({
			lint_output: result.lint_output,
			performance_header: result.performance.includes("# Linter performance"),
			performance_files: result.performance.includes("- Total files: 0"),
		}).toEqual({
			lint_output: "lint output\n",
			performance_header: true,
			performance_files: true,
		});
	});

	test("writes nested performance stages without double-counting", () => {
		const report = new PerformanceReport({
			root: "/project",
			files: ["source.ts"],
			durations: [
				{ name: "analysis", duration_ms: 1000 },
				{ name: "analysis.parse", duration_ms: 400 },
				{ name: "analysis.parse.types", duration_ms: 100 },
			],
		});
		const performance = report.markdown();
		expect({
			parse: performance.includes("| analysis.parse | 0.400 sec |"),
			types: performance.includes("| analysis.parse.types | 0.100 sec |"),
			total: performance.includes("| Total measured stages | 1.000 sec |"),
		}).toEqual({ parse: true, types: true, total: true });
	});
});
