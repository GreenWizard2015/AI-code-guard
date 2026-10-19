import { join, resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task_reporting";
import type { ReportViolation } from "src/types";
import { ReportPublicationFailureIO } from "tests/bridge/ts/core/support/report_publication_failure_io";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("task reporting first publication", () => {
	const files = { "a.ts": "const first = 1;\n", "b.ts": "const first = 1;\n" };
	const violation: ReportViolation = {
		file: "a.ts",
		line: 1,
		message: "parse-error message",
		hint: "parse-error hint",
		rule_id: "parse-error",
		priority: 3,
	};

	test("removes a first batch completely when report publication fails", () => {
		let io: ReportPublicationFailureIO | undefined;
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create_with_file_io_factory(files, (root, source_files) => {
			const absolute_files = new Map(Object.entries(source_files).map(([file, text]) => [resolve(root, file), text]));
			io = new ReportPublicationFailureIO(root);
			io.seed_files(absolute_files);
			return io;
		});
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		io?.fail_next_report_write();
		let error_message = "";
		try {
			reporting.format([violation], { batch_size: 10, policy: "all", skip_review: false });
		} catch (error) {
			error_message = String(error);
		}

		expect({
			error: error_message,
			issues: fixture.file_io.file_paths.path_exists(fixture.task_path("issues.md")),
			report: fixture.file_io.file_paths.path_exists(fixture.task_path("report.md")),
			lint_output: fixture.file_io.file_paths.path_exists(fixture.task_path("lint-output.md")),
			rule: fixture.file_io.file_paths.path_exists(fixture.task_path("rules/typescript-parse-error.md")),
		}).toEqual({
			error: expect.stringContaining("Injected report publication failure"),
			issues: false,
			report: false,
			lint_output: false,
			rule: false,
		});
	});

	test("restores the previous batch when replacement fails", () => {
		let io: ReportPublicationFailureIO | undefined;
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create_with_file_io_factory(files, (root, source_files) => {
			const absolute_files = new Map(Object.entries(source_files).map(([file, text]) => [resolve(root, file), text]));
			io = new ReportPublicationFailureIO(root);
			io.seed_files(absolute_files);
			return io;
		});
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		reporting.documents.write_document("issues", "old issues");
		reporting.documents.write_document("report", "old report");
		reporting.documents.write_document("lint-output", "old output");
		const rules = fixture.task_path("rules");
		fixture.file_io.directory_operations.create_directory(rules);
		fixture.file_io.file_content.write_text(join(rules, "old-rule.md"), "old rule");
		io?.fail_next_report_write();

		expect(() => reporting.format([violation], { batch_size: 10, policy: "all", skip_review: false })).toThrow(
			"Injected report publication failure",
		);
		expect({
			issues: fixture.task_text("issues.md"),
			report: fixture.task_text("report.md"),
			lint_output: fixture.task_text("lint-output.md"),
			rule: fixture.file_io.file_content.file_text(join(rules, "old-rule.md")),
		}).toEqual({
			issues: "old issues\n",
			report: "old report\n",
			lint_output: "old output\n",
			rule: "old rule",
		});
	});
});
