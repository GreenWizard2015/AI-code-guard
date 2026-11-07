import { join, resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { ViolationValue } from "src/model/violation_value";
import type { ViolationContract } from "src/reporting_protocols";
import { TaskPublicationFailureIO } from "tests/bridge/ts/core/support/report_publication_failure_io";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("task reporting first publication", () => {
	const files = { "a.ts": "const first = 1;\n", "b.ts": "const first = 1;\n" };
	const violation: ViolationContract = new ViolationValue({
		file: "a.ts",
		line: 1,
		message: "parse-error message",
		hint: "parse-error hint",
		rule_id: "parse-error",
		priority: 3,
	});

	test("removes a first batch completely when report publication fails", () => {
		let io: TaskPublicationFailureIO | undefined;
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create_with_file_io_factory(files, (root, source_files) => {
			const absolute_files = new Map(Object.entries(source_files).map(([file, text]) => [resolve(root, file), text]));
			io = new TaskPublicationFailureIO(root);
			io.seed_files(absolute_files);
			return io;
		});
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		if (io !== undefined) {
			io.fail_next_report_write();
		}
		expect(() => reporting.format([violation], { batch_size: 10, policy: "all", skip_review: false })).toThrow(
			"Injected report publication failure",
		);

		expect({
			issues: fixture._file_io.file(fixture.task_path("issues.md")).path_exists(),
			report: fixture._file_io.file(fixture.task_path("report.md")).path_exists(),
			lint_output: fixture._file_io.file(fixture.task_path("lint-output.md")).path_exists(),
			rule: fixture._file_io.file(fixture.task_path("rules/typescript-parse-error.md")).path_exists(),
		}).toEqual({
			issues: false,
			report: false,
			lint_output: false,
			rule: false,
		});
	});

	test("restores the previous batch when replacement fails", () => {
		let io: TaskPublicationFailureIO | undefined;
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create_with_file_io_factory(files, (root, source_files) => {
			const absolute_files = new Map(Object.entries(source_files).map(([file, text]) => [resolve(root, file), text]));
			io = new TaskPublicationFailureIO(root);
			io.seed_files(absolute_files);
			return io;
		});
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		fixture._documents.write_document("issues", "old issues");
		fixture._documents.write_document("report", "old report");
		fixture._documents.write_document("lint-output", "old output");
		const rules = fixture.task_path("rules");
		fixture._file_io.create_directory(rules);
		fixture._file_io.file(join(rules, "old-rule.md")).write_text("old rule");
		if (io !== undefined) {
			io.fail_next_report_write();
		}

		expect(() => reporting.format([violation], { batch_size: 10, policy: "all", skip_review: false })).toThrow(
			"Injected report publication failure",
		);
		expect({
			issues: fixture.task_text("issues.md"),
			report: fixture.task_text("report.md"),
			lint_output: fixture.task_text("lint-output.md"),
			rule: fixture._file_io.file(join(rules, "old-rule.md")).file_text(),
		}).toEqual({
			issues: "old issues\n",
			report: "old report\n",
			lint_output: "old output\n",
			rule: "old rule",
		});
	});
});
