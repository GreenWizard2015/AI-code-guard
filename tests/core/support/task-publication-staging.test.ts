import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { join, resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task_reporting";
import type { ReportViolation } from "src/reporting_protocols";
import { ReportPublicationFailureIO } from "tests/bridge/ts/core/support/report_publication_failure_io";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("task publication staging", () => {
	const fixture_factory = new TaskReportingMemoryFixture();
	const reporting_files = { "a.ts": "const first = 1;\n", "b.ts": "const first = 1;\n" };
	/** Responsibilities: _report violation fixture creation_. **/
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

	test("keeps the previous task when rule staging fails", () => {
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		reporting.documents.write_document("issues", "previous issues");
		reporting.documents.write_document("report", "previous report");
		expect(() =>
			reporting.format([violation("a.ts", 1, "missing-rule", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			}),
		).toThrow("missing-rule");

		expect({
			issues: fixture.task_text("issues.md"),
			report: fixture.task_text("report.md"),
		}).toEqual({
			issues: "previous issues\n",
			report: "previous report\n",
		});
	});

	test("restores the previous task when issue publication fails after replacement starts", () => {
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		reporting.format([violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		reporting.documents.write_document("lint-output", "previous lint output");
		const rules = fixture.task_path("rules");
		fixture.file_io.directory_operations.create_directory(rules);
		fixture.file_io.file_content.write_text(join(rules, "parse-error.md"), "previous rule\n");
		const previous = [
			fixture.task_text("issues.md"),
			fixture.task_text("report.md"),
			fixture.task_text("lint-output.md"),
			fixture.file_io.file_content.file_text(join(rules, "parse-error.md")),
		];
		expect(() =>
			reporting.batch.replace({
				staged_rules: fixture.task_path("missing-staged-rules"),
				rule_ids: ["missing-rule"],
				issues: "next issues",
				documents: new Map(),
			}),
		).toThrow("File does not exist");
		expect([
			fixture.task_text("issues.md"),
			fixture.task_text("report.md"),
			fixture.task_text("lint-output.md"),
			fixture.file_io.file_content.file_text(join(rules, "parse-error.md")),
		]).toEqual(previous);
	});

	test("restores every previous task document when report publication fails", () => {
		let file_io: ReportPublicationFailureIO | undefined;
		const fixture = fixture_factory.create_with_file_io_factory(reporting_files, (root, files) => {
			const absolute_files = new Map(Object.entries(files).map(([file, text]) => [resolve(root, file), text]));
			file_io = new ReportPublicationFailureIO(root);
			file_io.seed_files(absolute_files);
			return file_io;
		});
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		reporting.format([violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		reporting.documents.write_document("lint-output", "previous lint output");
		const previous = {
			issues: fixture.task_text("issues.md"),
			report: fixture.task_text("report.md"),
			lint_output: fixture.task_text("lint-output.md"),
		};
		file_io?.fail_next_report_write();
		let current = previous;
		expect(() => {
			try {
				reporting.format([violation("b.ts", 1, "unused-file", 3)], {
					batch_size: 10,
					policy: "all",
					skip_review: false,
				});
			} finally {
				current = {
					issues: fixture.task_text("issues.md"),
					report: fixture.task_text("report.md"),
					lint_output: fixture.task_text("lint-output.md"),
				};
			}
		}).toThrow("Injected report publication failure");
		expect(current).toEqual(previous);
	});
});
