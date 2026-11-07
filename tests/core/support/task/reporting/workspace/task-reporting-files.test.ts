import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { TaskWorkspace } from "src/core/support/task/reporting/workspace/task_workspace";
import { ViolationValue } from "src/model/violation_value";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("coding-lint task reporting files", () => {
	const fixture_factory = new TaskReportingMemoryFixture();
	/** Responsibilities: _construction task-reporting violation fixture_. **/
	const violation = (file: string, line: number, rule_id: string, priority: number): ViolationValue =>
		new ViolationValue({
			file,
			line,
			message: `${rule_id} message`,
			hint: `${rule_id} hint`,
			rule_id,
			priority,
		});
	const reporting_files = {
		"a.ts": "const first = 1;\n",
		"b.ts": "const first = 1;\n",
	};

	test("writes different hints beside their corresponding lines", () => {
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format(
			[
				new ViolationValue({
					file: "a.ts",
					line: 1,
					message: "module-placement message",
					hint: "move a",
					rule_id: "module-placement",
					priority: 3,
				}),
				new ViolationValue({
					file: "b.ts",
					line: 1,
					message: "module-placement message",
					hint: "move b",
					rule_id: "module-placement",
					priority: 3,
				}),
			],
			{ batch_size: 10, policy: "all", skip_review: false },
		);
		const document = fixture.task_text("issues.md");
		const first_line = document.indexOf("- Line 1: const first = 1;");
		expect({
			common_hint: document.indexOf("Hint: move a") < first_line,
			first_hint: document.split("Hint: move a").length - 1,
			second_hint: document.split("Hint: move b").length - 1,
		}).toEqual({ common_hint: false, first_hint: 1, second_hint: 1 });
	});

	test("clears stale task files", () => {
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const rules = fixture.task_path("rules");
		fixture._file_io.create_directory(rules);
		fixture._file_io.file(join(rules, "stale.md")).write_text("stale");
		reporting.format([], { batch_size: 1, policy: "all", skip_review: false });
		expect(fixture._file_io.list_entries(rules)).toEqual([]);
	});

	test("keeps surviving diagnostics when a source file disappears after analysis", () => {
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
		fixture._file_io.file(join(fixture._root, "a.ts")).remove_file();
		reporting.format([violation("a.ts", 1, "parse-error", 3), violation("b.ts", 1, "unused-file", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const result = fixture.task_text("issues.md");
		expect(result).toContain("(source unavailable)");
		expect(result).toContain("/b.ts");
	});

	test("applies the batch size and per-file maximum priority without changing totals", () => {
		const fixture = fixture_factory.create(reporting_files);
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format(
			[
				violation("a.ts", 1, "parse-error", 3),
				violation("a.ts", 1, "unused-file", 2),
				violation("b.ts", 1, "parse-error", 3),
			],
			{ batch_size: 1, policy: "all", skip_review: false },
		);
		const result = { output, issue_document: fixture.task_text("issues.md") };
		expect({
			output: result.output.includes("Total files: 2."),
			unused: result.issue_document.includes("Problem: unused-file message"),
		}).toEqual({ output: true, unused: false });
	});

	test("keeps every directory diagnostic in the task document", () => {
		const fixture = fixture_factory.create({
			"source/a.ts": "const a = 1;\n",
			"source/b.ts": "const b = 2;\n",
		});
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format(
			[
				new ViolationValue({
					file: "source",
					line: 1,
					message: "first directory problem",
					hint: "directory-min-size hint",
					rule_id: "directory-min-size",
					priority: 3,
				}),
				new ViolationValue({
					file: "source",
					line: 1,
					message: "second directory problem",
					hint: "directory-min-size hint",
					rule_id: "directory-min-size",
					priority: 3,
				}),
			],
			{ batch_size: 10, policy: "all", skip_review: true },
		);
		const issue_document = fixture.task_text("issues.md");
		expect({
			first: issue_document.includes("Problem: first directory problem"),
			second: issue_document.includes("Problem: second directory problem"),
		}).toEqual({ first: true, second: true });
	});

	test("copies rule documents without copying the review instruction", () => {
		const fixture = fixture_factory.create({ "source.ts": "const result = 1;\n" });
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format([violation("source.ts", 1, "parse-error", 2)], {
			batch_size: 10,
			policy: "top-category",
			skip_review: false,
		});
		const result = {
			rule_document: fixture._file_io.file(fixture.task_path("rules/typescript-parse-error.md")).file_text(),
			agent_document: fixture._file_io.file(fixture.task_path("architecture-review-prompt.md")).path_exists(),
			issues: fixture.task_text("issues.md"),
		};
		expect({
			rule_document: result.rule_document.includes("# `parse-error`"),
			agent_document: result.agent_document,
			issues: result.issues.includes("## ") && result.issues.includes("/source.ts"),
		}).toEqual({ rule_document: true, agent_document: false, issues: true });
	});

	test("splits one shared rule's task diagnostics and document copies by source language", () => {
		const fixture = fixture_factory.create({
			"source.ts": "const value: string = 'x';\n",
			"source.py": "value: str = 'x'\n",
		});
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		reporting.format(
			[
				new ViolationValue({
					file: "source.ts",
					line: 1,
					message: "missing explicit TypeScript return",
					hint: "explicit-return-type hint",
					rule_id: "explicit-return-type",
					priority: 5,
				}),
				new ViolationValue({
					file: "source.py",
					line: 1,
					message: "missing explicit Python return",
					hint: "explicit-return-type hint",
					rule_id: "explicit-return-type",
					priority: 5,
				}),
			],
			{ batch_size: 10, policy: "all", skip_review: true },
		);
		const result = {
			issues: fixture.task_text("issues.md"),
			report: fixture.task_text("report.md"),
			rule_documents: fixture._file_io
				.list_entries(fixture.task_path("rules"))
				.map((entry) => ({ name: entry.name, is_file: entry.is_file }))
				.sort((first, second) => first.name.localeCompare(second.name)),
		};

		expect({
			issues: [
				result.issues.includes("# explicit-return-type[typescript]"),
				result.issues.includes("# explicit-return-type[python]"),
				result.issues.includes("rules/typescript-explicit-return-type.md"),
				result.issues.includes("rules/python-explicit-return-type.md"),
			],
			report: [
				result.report.includes("`explicit-return-type[typescript]`"),
				result.report.includes("`explicit-return-type[python]`"),
			],
			rule_documents: result.rule_documents,
		}).toEqual({
			issues: [true, true, true, true],
			report: [true, true],
			rule_documents: [
				{ name: "python-explicit-return-type.md", is_file: true },
				{ name: "typescript-explicit-return-type.md", is_file: true },
			],
		});
	});

	test("writes unresolved review paths to issues", () => {
		const fixture = fixture_factory.create({ "source.ts": "const result = 1;\n" });
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const review = fixture.task_path("review");
		fixture._file_io.create_directory(review);
		fixture._file_io.file(join(review, "open.md")).write_text("confirmed architectural defect\n");
		reporting.format([], { batch_size: 10, policy: "all", skip_review: false });
		const issue_document = fixture.task_text("issues.md");

		expect(issue_document).toContain("# Unresolved architecture review files");
		expect(issue_document).toContain("/.ai-code-guard/review/open.md");
	});

	test("archives resolved reviews during lint reporting and keeps open findings active", () => {
		const fixture = fixture_factory.create(reporting_files);
		const review_directory = fixture.task_path("review");
		const resolved_file = join(review_directory, "resolved.md");
		const open_file = join(review_directory, "open.md");
		fixture._file_io.create_directory(review_directory);
		fixture._file_io.file(resolved_file).write_text("Confirmed defect\nStatus: Resolved\n");
		fixture._file_io.file(open_file).write_text("Confirmed defect\nStatus: Open\n");
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});

		reporting.format([], { batch_size: 10, policy: "all", skip_review: true });

		expect({
			archived: fixture._file_io.file(fixture.task_path("resolved-review/resolved.md")).path_exists(),
			removed_from_active: !fixture._file_io.file(resolved_file).path_exists(),
			open_remains_active: fixture._file_io.file(open_file).path_exists(),
			lists_open_file: fixture.task_text("issues.md").includes("/review/open.md"),
			omits_resolved_file: !fixture.task_text("issues.md").includes("/review/resolved.md"),
		}).toEqual({
			archived: true,
			removed_from_active: true,
			open_remains_active: true,
			lists_open_file: true,
			omits_resolved_file: true,
		});
	});

	test("keeps the hook at its TypeScript source path", () => {
		const fixture = fixture_factory.create(reporting_files);
		const workspace = new TaskWorkspace(fixture._root, fixture._file_io);
		workspace.prepare_review();
		const result = fixture._file_io.file(fixture.task_path("agent-hooks.ts")).path_exists();
		expect(result).toBe(false);
	});
});
