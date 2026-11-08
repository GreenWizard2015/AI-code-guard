import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskPublicationRecovery } from "src/core/support/task/publication/task_publication_recovery";
import { TaskPublicationLock } from "src/core/support/task/reporting/workspace/task_publication_lock";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import type { IOContract } from "src/io/protocols";
import { ViolationValue } from "src/model/violation_value";
import { TaskPublicationFaultIO } from "tests/bridge/ts/core/support/task-publication-fault-io";
import { TaskPublicationRecoveryScenario } from "tests/bridge/ts/core/support/task-publication-recovery-scenario";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";
import type { CallableTaskReportingAction } from "tests/core/types";

describe("task publication recovery", () => {
	/** Responsibilities: _publication violation fixture creation_. **/
	const reporting_files = {
		"a.ts": "const first = 1;\n",
		"b.ts": "const first = 1;\n",
	};
	/** Responsibilities: _in-memory task reporting setup_. **/
	const with_reporting = <T>(callback: CallableTaskReportingAction<T>): T => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(reporting_files);
		return callback(fixture);
	};
	/** Responsibilities: _task reporting fixture creation_. **/
	const create_reporting_fixture = (): TaskReportingMemoryWorkspace => {
		const fixture_factory = new TaskReportingMemoryFixture();
		return fixture_factory.create(reporting_files);
	};
	/** Responsibilities: _directory failure fixture_. **/
	const create_temporary_directory_failure_fixture = (): {
		workspace: TaskReportingMemoryWorkspace<IOContract>;
		lock_path: string;
		options: { readonly batch_size: 10; readonly policy: "all"; readonly skip_review: false };
	} => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const file_io = new TaskPublicationFaultIO();
		const workspace = fixture_factory.create_with_file_io_factory(reporting_files, (root, files) => {
			file_io.seed_files(new Map(Object.entries(files).map(([path, content]) => [join(root, path), content])));
			return file_io;
		});
		file_io.fail_next_transaction_allocation();
		const options = { batch_size: 10, policy: "all", skip_review: false } as const;
		return {
			workspace,
			lock_path: join(workspace._root, ".ai-code-guard", ".task-publication-lock"),
			options,
		};
	};
	/** Responsibilities: _abandoned publication staging_. **/
	const stage_abandoned_publication = (
		file_io: IOContract,
		root: string,
		workspace: string,
	): { transaction: string; lock: string } => {
		const transaction = file_io.temporary_directory(root, ".ai-code-guard-task-");
		file_io.move_path(join(workspace, "rules"), join(transaction, "rules"));
		file_io.create_directory(join(workspace, "rules"));
		file_io.file(join(workspace, "rules", "partial.md")).write_text("partial\n");
		for (const document of ["issues", "report", "lint-output"] as const) {
			file_io.move_path(join(workspace, `${document}.md`), join(transaction, `${document}.md`));
		}
		file_io.file(join(transaction, "journal")).write_text("1\nissues\nreport\nlint-output");
		const lock = join(workspace, ".task-publication-lock");
		file_io.create_directory(lock);
		file_io.file(join(lock, "owner")).write_text(`999999999\n${transaction}\n`);
		return { transaction, lock };
	};
	/** Responsibilities: _publication violation fixture creation_. **/
	const violation = (file: string, line: number, rule_id: string, priority: number): ViolationValue =>
		new ViolationValue({
			file,
			line,
			message: `${rule_id} message`,
			hint: `${rule_id} hint`,
			rule_id,
			priority,
		});
	/** Responsibilities: _malformed journal recovery setup_. **/
	const malformed_journal_fixture = (): TaskReportingMemoryWorkspace => {
		const fixture = create_reporting_fixture();
		const { _root, _file_io: io } = fixture;
		const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
		const options = { batch_size: 10, policy: "all", skip_review: false } as const;
		reporting.format([violation("a.ts", 1, "parse-error", 3)], options);
		const workspace = join(_root, ".ai-code-guard");
		const transaction = io.temporary_directory(_root, ".ai-code-guard-task-");
		io.file(join(transaction, "journal")).write_text("malformed\nunknown-document");
		const lock = join(workspace, ".task-publication-lock");
		io.create_directory(lock);
		io.file(join(lock, "owner")).write_text(`999999999\n${transaction}\n`);
		return fixture;
	};
	/** Responsibilities: _outside transaction recovery setup_. **/
	const outside_transaction_fixture = (): TaskReportingMemoryWorkspace => {
		const fixture = create_reporting_fixture();
		const { _root, _file_io: io } = fixture;
		const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
		const options = { batch_size: 10, policy: "all", skip_review: false } as const;
		reporting.format([violation("a.ts", 1, "parse-error", 3)], options);
		const outside_transaction = join(_root, "outside-transaction");
		io.create_directory(outside_transaction);
		io.file(join(outside_transaction, "journal")).write_text("prepared\n0");
		const lock = join(_root, ".ai-code-guard", ".task-publication-lock");
		io.create_directory(lock);
		io.file(join(lock, "owner")).write_text(`999999999\n${outside_transaction}\nold-token\n`);
		return fixture;
	};
	/** Responsibilities: _abandoned transaction lock creation_. **/
	const create_abandoned_lock = (fixture: TaskReportingMemoryWorkspace, transaction: string): string => {
		const lock = join(fixture._root, ".ai-code-guard", ".task-publication-lock");
		fixture._file_io.create_directory(lock);
		fixture._file_io.file(join(lock, "owner")).write_text(`999999999\n${transaction}\nold-token\n`);
		return lock;
	};
	/** Responsibilities: _prefix-sibling transaction fixture_. **/
	const sibling_transaction_fixture = (): TaskReportingMemoryWorkspace => {
		const fixture = create_reporting_fixture();
		const transaction = join(fixture._root, ".ai-code-guard-task-container", "unrelated");
		fixture._file_io.create_directory(transaction);
		fixture._file_io.file(join(transaction, "journal")).write_text("committed\n0\nissues");
		create_abandoned_lock(fixture, transaction);
		return fixture;
	};
	/** Responsibilities: _symbolic-link transaction fixture_. **/
	const symlink_transaction_fixture = (): TaskReportingMemoryWorkspace => {
		const fixture = create_reporting_fixture();
		const outside = join(fixture._root, "unrelated-transaction");
		const transaction_link = join(fixture._root, ".ai-code-guard-task-link");
		fixture._file_io.create_directory(outside);
		fixture._file_io.file(join(outside, "journal")).write_text("committed\n0\nissues");
		fixture._file_io.create_symbolic_link(transaction_link, outside);
		create_abandoned_lock(fixture, transaction_link);
		return fixture;
	};

	// Publication lock recovery.
	test("recovers an abandoned publication lock without spawning a process", () => {
		const result = with_reporting((fixture) => {
			const { _root, _file_io: io } = fixture;
			const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
			reporting.format([violation("a.ts", 1, "parse-error", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			const workspace = join(_root, ".ai-code-guard");
			const lock = join(workspace, ".task-publication-lock");
			io.create_directory(lock);
			io.file(join(lock, "owner")).write_text("999999999\n\n");
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			return {
				lock_exists: io.file(lock).path_exists(),
				issues: io.file(join(workspace, "issues.md")).file_text(),
			};
		});
		expect({ lock_exists: result.lock_exists, has_new_issue: result.issues.includes("unused-file") }).toEqual({
			lock_exists: false,
			has_new_issue: true,
		});
	});

	test("recovers an ownerless lock left by interrupted acquisition", () => {
		const result = with_reporting((fixture) => {
			const { _root, _file_io: io } = fixture;
			const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
			reporting.format([violation("a.ts", 1, "parse-error", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			const workspace = join(_root, ".ai-code-guard");
			const lock = join(workspace, ".task-publication-lock");
			io.create_directory(lock);
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			return {
				lock_exists: io.file(lock).path_exists(),
				issues: io.file(join(workspace, "issues.md")).file_text(),
			};
		});
		expect(result).toEqual({ lock_exists: false, issues: expect.stringContaining("unused-file") });
	});

	test("releases the publication lock when transaction directory creation fails", async () => {
		const { workspace: fixture, lock_path: lock, options } = create_temporary_directory_failure_fixture();
		const { _root, _file_io: io } = fixture;
		const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
		const failure_message = await Promise.resolve()
			.then(() => reporting.format([violation("a.ts", 1, "parse-error", 3)], options))
			.then(
				() => "",
				(error: unknown) => String(error),
			);
		const lock_released_after_failure = !io.file(lock).path_exists();
		reporting.format([violation("b.ts", 1, "unused-file", 3)], options);
		const issues = io.file(join(_root, ".ai-code-guard", "issues.md")).file_text();
		const result = {
			directory_creation_failed: failure_message.includes("transaction directory creation failure"),
			lock_released_after_failure,
			lock_released_after_retry: !io.file(lock).path_exists(),
			published: issues.includes("unused-file"),
		};
		expect(result).toEqual({
			directory_creation_failed: true,
			lock_released_after_failure: true,
			lock_released_after_retry: true,
			published: true,
		});
	});

	// Publication rollback recovery.
	test("keeps committed documents when recovery cleans a partially deleted transaction", () => {
		const result = with_reporting((fixture) => {
			const { _root, _file_io: io } = fixture;
			fixture._documents.write_document("issues", "committed issues\n");
			const workspace = join(_root, ".ai-code-guard");
			const transaction = io.temporary_directory(_root, ".ai-code-guard-task-");
			io.file(join(transaction, "issues.md")).write_text("old issues\n");
			io.file(join(transaction, "journal")).write_text("committed\n0\nissues");
			const lock = join(workspace, ".task-publication-lock");
			io.create_directory(lock);
			io.file(join(lock, "owner")).write_text(`999999999\n${transaction}\nold-token\n`);
			const recovery = new TaskPublicationRecovery(fixture._documents, join(workspace, "rules"), io);
			const publication_lock = new TaskPublicationLock(workspace, recovery, io);
			publication_lock.acquire();
			const issues = io.file(join(workspace, "issues.md")).file_text();
			publication_lock.release();
			return { issues, transaction_exists: io.file(transaction).path_exists() };
		});
		expect(result).toEqual({ issues: "committed issues\n", transaction_exists: false });
	});

	test("takes over a recovery claim abandoned by a dead recoverer", () => {
		const result = with_reporting((fixture) => {
			const { _root, _file_io: io } = fixture;
			const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
			reporting.format([violation("a.ts", 1, "parse-error", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			const workspace = join(_root, ".ai-code-guard");
			const lock = join(workspace, ".task-publication-lock");
			const claim = join(lock, "recovery");
			io.create_directory(claim);
			io.file(join(lock, "owner")).write_text("999999999\n\nold-owner-token\n");
			io.file(join(claim, "owner")).write_text("999999999\nold-owner-token\n");
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			return {
				lock_exists: io.file(lock).path_exists(),
				issues: io.file(join(workspace, "issues.md")).file_text(),
			};
		});
		expect(result).toEqual({ lock_exists: false, issues: expect.stringContaining("unused-file") });
	});

	test("restores an abandoned staged transaction before publishing the next task", () => {
		const result = with_reporting((fixture) => {
			const { _root, _file_io: io } = fixture;
			const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
			reporting.format([violation("a.ts", 1, "parse-error", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			const scenario = new TaskPublicationRecoveryScenario(fixture, fixture._batch);
			const previous = scenario.documents();
			const workspace = join(_root, ".ai-code-guard");
			const { transaction, lock } = stage_abandoned_publication(io, _root, workspace);
			const recovery = new TaskPublicationRecovery(fixture._documents, join(workspace, "rules"), io);
			const recovery_lock = new TaskPublicationLock(workspace, recovery, io);
			recovery_lock.acquire();
			const recovered = scenario.documents();
			recovery_lock.release();
			return {
				lock_exists: io.file(lock).path_exists(),
				previous,
				recovered,
				partial_rule_exists: io.file(join(workspace, "rules", "partial.md")).path_exists(),
				transaction_exists: io.file(transaction).path_exists(),
			};
		});
		expect({
			lock_exists: result.lock_exists,
			recovered: [...result.recovered],
			previous: [...result.previous],
			partial_rule_exists: result.partial_rule_exists,
			transaction_exists: result.transaction_exists,
		}).toEqual({
			lock_exists: false,
			recovered: [...result.previous],
			previous: [...result.previous],
			partial_rule_exists: false,
			transaction_exists: false,
		});
	});

	test("restores committed documents after replacement failure", () => {
		const fixture = create_reporting_fixture();
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const scenario = new TaskPublicationRecoveryScenario(fixture, fixture._batch);
		const previous = scenario.prepare(reporting);
		expect(() => scenario.fail_replacement()).toThrow("missing-staged-rules");
		expect(scenario.documents()).toEqual(previous);
	});

	// Publication owner and journal validation.
	test("does not replace a live publication owner", () => {
		const fixture = create_reporting_fixture();
		const { _root, _file_io: io } = fixture;
		const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
		reporting.format([violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const workspace = join(_root, ".ai-code-guard");
		const previous = io.file(join(workspace, "issues.md")).file_text();
		const lock = join(workspace, ".task-publication-lock");
		io.create_directory(lock);
		io.file(join(lock, "owner")).write_text(`${process.pid}\n\nactive-token\n`);
		expect(() =>
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			}),
		).toThrow("live or unverifiable");
		expect({
			lock_exists: io.file(lock).path_exists(),
			issues: io.file(join(workspace, "issues.md")).file_text(),
			previous,
		}).toEqual({
			lock_exists: true,
			issues: previous,
			previous,
		});
	});

	test("rejects a malformed abandoned journal without touching live artifacts", () => {
		const fixture = malformed_journal_fixture();
		const { _root, _file_io: io } = fixture;
		const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
		const workspace = join(_root, ".ai-code-guard");
		const lock = join(workspace, ".task-publication-lock");
		const previous = io.file(join(workspace, "issues.md")).file_text();
		const transaction_path = io.file(join(lock, "owner")).file_text().split("\n").slice(1, 2).join("");
		expect(() =>
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			}),
		).toThrow("journal is unavailable");
		expect({
			issues_unchanged: io.file(join(workspace, "issues.md")).file_text() === previous,
			lock_exists: io.file(lock).path_exists(),
			transaction_exists: io.file(transaction_path).path_exists(),
		}).toEqual({
			issues_unchanged: true,
			lock_exists: true,
			transaction_exists: true,
		});
	});

	// Transaction path containment and symlink safety.
	test("rejects an abandoned transaction outside the workspace", () => {
		const fixture = outside_transaction_fixture();
		const { _root, _file_io: io } = fixture;
		const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
		const options = { batch_size: 10, policy: "all", skip_review: false } as const;
		const workspace = join(_root, ".ai-code-guard");
		const previous_issues = io.file(join(workspace, "issues.md")).file_text();
		const outside_transaction = join(_root, "outside-transaction");
		const lock = join(workspace, ".task-publication-lock");

		expect(() => reporting.format([violation("b.ts", 1, "unused-file", 3)], options)).toThrow("outside the workspace");
		expect([
			io.file(join(workspace, "issues.md")).file_text() === previous_issues,
			io.file(lock).path_exists(),
			io.file(join(lock, "recovery")).path_exists(),
			io.file(outside_transaction).path_exists(),
		]).toEqual([true, true, false, true]);
	});

	test("rejects a nested sibling whose name only shares the transaction prefix", () => {
		const fixture = sibling_transaction_fixture();
		const { _root, _file_io: io } = fixture;
		const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
		const options = { batch_size: 10, policy: "all", skip_review: false } as const;
		const unrelated_transaction = join(_root, ".ai-code-guard-task-container", "unrelated");
		const issues_path = join(_root, ".ai-code-guard", "issues.md");
		const issues_existed_before = io.file(issues_path).path_exists();

		expect(() => reporting.format([violation("b.ts", 1, "unused-file", 3)], options)).toThrow("outside the workspace");
		expect({
			issues_unchanged: io.file(issues_path).path_exists() === issues_existed_before,
			unrelated_transaction_exists: io.file(unrelated_transaction).path_exists(),
			unrelated_journal_exists: io.file(join(unrelated_transaction, "journal")).path_exists(),
		}).toEqual({ issues_unchanged: true, unrelated_transaction_exists: true, unrelated_journal_exists: true });
	});

	test("rejects a transaction root that is a symbolic link before recovery mutations", () => {
		const fixture = symlink_transaction_fixture();
		const { _root, _file_io: io } = fixture;
		const reporting = new TaskReporting(_root, { file_io: io, documentation: fixture._documentation });
		const options = { batch_size: 10, policy: "all", skip_review: false } as const;
		const outside = join(_root, "unrelated-transaction");
		const transaction_link = join(_root, ".ai-code-guard-task-link");
		const issues_path = join(_root, ".ai-code-guard", "issues.md");
		const issues_existed_before = io.file(issues_path).path_exists();

		expect(() => reporting.format([violation("b.ts", 1, "unused-file", 3)], options)).toThrow("outside the workspace");
		expect({
			issues_unchanged: io.file(issues_path).path_exists() === issues_existed_before,
			link_exists: io.symbolic_link(transaction_link),
			outside_exists: io.file(outside).path_exists(),
			outside_journal_exists: io.file(join(outside, "journal")).path_exists(),
		}).toEqual({
			issues_unchanged: true,
			link_exists: true,
			outside_exists: true,
			outside_journal_exists: true,
		});
	});
});
