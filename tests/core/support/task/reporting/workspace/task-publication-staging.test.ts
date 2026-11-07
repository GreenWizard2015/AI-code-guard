import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { join, resolve } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { ViolationValue } from "src/model/violation_value";
import { TaskPublicationFailureIO } from "tests/bridge/ts/core/support/report_publication_failure_io";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("task publication staging", () => {
	const fixture_factory = new TaskReportingMemoryFixture();
	const reporting_files = { "a.ts": "const first = 1;\n", "b.ts": "const first = 1;\n" };
	/** Responsibilities: _report violation fixture creation_. **/
	const violation = (file: string, line: number, rule_id: string, priority: number): ViolationValue =>
		new ViolationValue({
			file,
			line,
			message: `${rule_id} message`,
			hint: `${rule_id} hint`,
			rule_id,
			priority,
		});

	test("keeps the previous task when rule staging fails", () => {
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		fixture._documents.write_document("issues", "previous issues");
		fixture._documents.write_document("report", "previous report");
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
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format([violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		fixture._documents.write_document("lint-output", "previous lint output");
		const rules = fixture.task_path("rules");
		fixture._file_io.create_directory(rules);
		fixture._file_io.file(join(rules, "parse-error.md")).write_text("previous rule\n");
		const previous = [
			fixture.task_text("issues.md"),
			fixture.task_text("report.md"),
			fixture.task_text("lint-output.md"),
			fixture._file_io.file(join(rules, "parse-error.md")).file_text(),
		];
		expect(() =>
			fixture._batch.replace({
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
			fixture._file_io.file(join(rules, "parse-error.md")).file_text(),
		]).toEqual(previous);
	});

	test("restores every previous task document when report publication fails", () => {
		let file_io: TaskPublicationFailureIO | undefined;
		const fixture = fixture_factory.create_with_file_io_factory(reporting_files, (root, files) => {
			const absolute_files = new Map(Object.entries(files).map(([file, text]) => [resolve(root, file), text]));
			file_io = new TaskPublicationFailureIO(root);
			file_io.seed_files(absolute_files);
			return file_io;
		});
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format([violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		fixture._documents.write_document("lint-output", "previous lint output");
		const previous = {
			issues: fixture.task_text("issues.md"),
			report: fixture.task_text("report.md"),
			lint_output: fixture.task_text("lint-output.md"),
		};
		if (file_io !== undefined) {
			file_io.fail_next_report_write();
		}
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

	test("recovers a failed rollback on the next publication in the same process", async () => {
		let file_io: TaskPublicationFailureIO | undefined;
		const fixture = fixture_factory.create_with_file_io_factory(reporting_files, (root, files) => {
			const absolute_files = new Map(Object.entries(files).map(([file, text]) => [resolve(root, file), text]));
			file_io = new TaskPublicationFailureIO(root);
			file_io.seed_files(absolute_files);
			return file_io;
		});
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format([violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const staged_rules = join(fixture._root, "staged-rules");
		fixture._file_io.create_directory(staged_rules);
		fixture._file_io.file(join(staged_rules, "parse-error.md")).write_text("current rule\n");
		if (file_io !== undefined) {
			file_io.fail_next_rules_restore();
		}
		const failed = {
			staged_rules: join(fixture._root, "missing-staged-rules"),
			rule_ids: ["parse-error"],
			issues: "failed publication",
			documents: new Map(),
		};

		const failure_message = await Promise.resolve()
			.then(() => fixture._batch.replace(failed))
			.then(
				() => "",
				(error: unknown) => String(error),
			);
		fixture._batch.replace({ ...failed, staged_rules, issues: "recovered publication" });

		expect({
			failure_message,
			issues: fixture.task_text("issues.md"),
			rule: fixture._file_io.file(join(fixture.task_path("rules"), "parse-error.md")).file_text(),
			lock_exists: fixture._file_io.file(fixture.task_path(".task-publication-lock")).path_exists(),
		}).toEqual({
			failure_message: expect.stringContaining("TaskPublicationRollbackError"),
			issues: "recovered publication\n",
			rule: "current rule\n",
			lock_exists: false,
		});
	});
});
