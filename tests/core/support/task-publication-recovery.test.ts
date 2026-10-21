import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskPublicationOwner } from "src/core/support/task/publication/task_publication_owner";
import { TaskPublicationRecovery } from "src/core/support/task/publication/task_publication_recovery";
import { TaskPublicationRecoveryClaim } from "src/core/support/task/publication/task_publication_recovery_claim";
import { TaskPublicationLock } from "src/core/support/task/task_publication_lock";
import type { TaskPublicationRecoveryContract } from "src/core/support/task/types";
import { TaskReporting } from "src/core/support/task_reporting";
import type { ReportViolation } from "src/reporting_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TaskPublicationRecoveryScenario } from "tests/bridge/ts/core/support/task-publication-recovery-scenario";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";

/** Responsibilities: _interleaving action scheduling_, _exclusive directory creation coordination_. **/
class InterleavingFileIO extends InMemoryFileIO {
	private readonly interleavings: Array<() => void> = [];
	private readonly target: string;

	/** Responsibilities: _race target initialization_. **/
	public constructor(target: string) {
		super();
		this.target = target;
	}

	/** Responsibilities: _race action scheduling_. **/
	public set_interleave(callback: () => void): void {
		this.interleavings.push(callback);
	}

	/** Responsibilities: _interleaved directory creation_. **/
	public override create_directory_exclusive(directory: string): void {
		super.create_directory_exclusive(directory);
		if (directory !== this.target && !directory.startsWith(`${this.target}.`)) {
			return;
		}
		const callback = this.interleavings.shift();
		callback?.();
	}
}

describe("task publication recovery", () => {
	/** Responsibilities: _publication violation fixture creation_. **/
	const reporting_files = {
		"a.ts": "const first = 1;\n",
		"b.ts": "const first = 1;\n",
	};
	/** Responsibilities: _in-memory task reporting setup_. **/
	const with_reporting = <T>(callback: (fixture: TaskReportingMemoryWorkspace) => T): T => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create(reporting_files);
		return callback(fixture);
	};
	/** Responsibilities: _task reporting fixture creation_. **/
	const create_reporting_fixture = (): TaskReportingMemoryWorkspace => {
		const fixture_factory = new TaskReportingMemoryFixture();
		return fixture_factory.create(reporting_files);
	};
	/** Responsibilities: _publication violation fixture creation_. **/
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

	test("publishes one fully initialized recovery claim under an interleaving contender", () => {
		const claim_path = "/virtual/task-publication/recovery";
		const io = new InterleavingFileIO(claim_path);
		io.directory_operations.create_directory("/virtual/task-publication");
		const first = new TaskPublicationRecoveryClaim("/virtual/task-publication/lock", "first", io);
		const second = new TaskPublicationRecoveryClaim("/virtual/task-publication/lock", "second", io);
		io.set_interleave(() => second.claim(claim_path));
		expect(() => first.claim(claim_path)).toThrow("Task publication recovery claim failed");

		expect({
			owner_lines: io.file_content.file_text(join(claim_path, "owner")).split("\n"),
		}).toEqual({ owner_lines: [String(process.pid), "second", expect.any(String), expect.any(String), ""] });
	});

	test("does not treat a reused PID as the publication lock owner", () => {
		const pid = process.pid;
		const boot_id = "test-boot";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[`/proc/${pid}/stat`, `1 (node) ${Array.from({ length: 19 }, () => "0").join(" ")} current-start\n`],
				["/proc/sys/kernel/random/boot_id", `${boot_id}\n`],
			]),
		);
		const owner = new TaskPublicationOwner(pid, "", "token", `${pid}\nold-start\n${boot_id}\n`, file_io);

		expect(owner.live()).toBe(false);
	});

	test("recovers an abandoned publication lock without spawning a process", () => {
		const result = with_reporting((fixture) => {
			const { root, file_io: io } = fixture;
			const reporting = new TaskReporting(root, { file_io: io, documentation: fixture.documentation });
			reporting.format([violation("a.ts", 1, "parse-error", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			const workspace = join(root, ".ai-code-guard");
			const lock = join(workspace, ".task-publication-lock");
			io.directory_operations.create_directory(lock);
			io.file_content.write_text(join(lock, "owner"), "999999999\n\n");
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			return {
				lock_exists: io.file_paths.path_exists(lock),
				issues: io.file_content.file_text(join(workspace, "issues.md")),
			};
		});
		expect({ lock_exists: result.lock_exists, has_new_issue: result.issues.includes("unused-file") }).toEqual({
			lock_exists: false,
			has_new_issue: true,
		});
	});

	test("recovers an ownerless lock left by interrupted acquisition", () => {
		const result = with_reporting((fixture) => {
			const { root, file_io: io } = fixture;
			const reporting = new TaskReporting(root, { file_io: io, documentation: fixture.documentation });
			reporting.format([violation("a.ts", 1, "parse-error", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			const workspace = join(root, ".ai-code-guard");
			const lock = join(workspace, ".task-publication-lock");
			io.directory_operations.create_directory(lock);
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			return {
				lock_exists: io.file_paths.path_exists(lock),
				issues: io.file_content.file_text(join(workspace, "issues.md")),
			};
		});
		expect(result).toEqual({ lock_exists: false, issues: expect.stringContaining("unused-file") });
	});

	test("keeps committed documents when recovery cleans a partially deleted transaction", () => {
		const result = with_reporting((fixture) => {
			const { root, file_io: io } = fixture;
			const reporting = new TaskReporting(root, { file_io: io, documentation: fixture.documentation });
			reporting.documents.write_document("issues", "committed issues\n");
			const workspace = join(root, ".ai-code-guard");
			const transaction = io.directory_operations.temporary_directory(root, ".ai-code-guard-task-");
			io.file_content.write_text(join(transaction, "issues.md"), "old issues\n");
			io.file_content.write_text(join(transaction, "journal"), "committed\n0\nissues");
			const lock = join(workspace, ".task-publication-lock");
			io.directory_operations.create_directory(lock);
			io.file_content.write_text(join(lock, "owner"), `999999999\n${transaction}\nold-token\n`);
			const recovery = new TaskPublicationRecovery(reporting.documents, join(workspace, "rules"), io);
			const publication_lock = new TaskPublicationLock(workspace, recovery, io);
			publication_lock.acquire();
			const issues = io.file_content.file_text(join(workspace, "issues.md"));
			publication_lock.release();
			return { issues, transaction_exists: io.file_paths.path_exists(transaction) };
		});
		expect(result).toEqual({ issues: "committed issues\n", transaction_exists: false });
	});

	test("takes over a recovery claim abandoned by a dead recoverer", () => {
		const result = with_reporting((fixture) => {
			const { root, file_io: io } = fixture;
			const reporting = new TaskReporting(root, { file_io: io, documentation: fixture.documentation });
			reporting.format([violation("a.ts", 1, "parse-error", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			const workspace = join(root, ".ai-code-guard");
			const lock = join(workspace, ".task-publication-lock");
			const claim = join(lock, "recovery");
			io.directory_operations.create_directory(claim);
			io.file_content.write_text(join(lock, "owner"), "999999999\n\nold-owner-token\n");
			io.file_content.write_text(join(claim, "owner"), "999999999\nold-owner-token\n");
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			return {
				lock_exists: io.file_paths.path_exists(lock),
				issues: io.file_content.file_text(join(workspace, "issues.md")),
			};
		});
		expect(result).toEqual({ lock_exists: false, issues: expect.stringContaining("unused-file") });
	});

	test("rejects a recovery owner change before removing the live lock", () => {
		const fixture = create_reporting_fixture();
		const { root, file_io: io } = fixture;
		const workspace = join(root, ".ai-code-guard");
		const transaction = io.directory_operations.temporary_directory(root, ".ai-code-guard-task-");
		io.file_content.write_text(join(transaction, "journal"), "prepared\n0");
		const lock = join(workspace, ".task-publication-lock");
		io.directory_operations.create_directory(lock);
		io.file_content.write_text(join(lock, "owner"), `999999999\n${transaction}\noriginal-token\n`);
		const recovery: TaskPublicationRecoveryContract = {
			backup_documents: () => new Map(),
			existing_documents: () => new Set(),
			restore: () => {
				io.file_content.write_text(join(lock, "owner"), `${process.pid}\n${transaction}\nreplacement-token\n`);
			},
		};
		const publication_lock = new TaskPublicationLock(workspace, recovery, io);

		expect(() => publication_lock.acquire()).toThrow("owner changed during recovery");
		expect({
			lock_exists: io.file_paths.path_exists(lock),
			claim_exists: io.file_paths.path_exists(join(lock, "recovery")),
		}).toEqual({
			lock_exists: true,
			claim_exists: false,
		});
	});

	test("restores an abandoned staged transaction before publishing the next task", () => {
		const result = with_reporting((fixture) => {
			const { root, file_io: io } = fixture;
			const reporting = new TaskReporting(root, { file_io: io, documentation: fixture.documentation });
			reporting.format([violation("a.ts", 1, "parse-error", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			const workspace = join(root, ".ai-code-guard");
			const transaction = io.directory_operations.temporary_directory(root, ".ai-code-guard-task-");
			io.directory_operations.move_path(join(workspace, "rules"), join(transaction, "rules"));
			io.directory_operations.create_directory(join(workspace, "rules"));
			io.file_content.write_text(join(workspace, "rules", "partial.md"), "partial\n");
			for (const document of ["issues", "report", "lint-output"] as const) {
				io.directory_operations.move_path(join(workspace, `${document}.md`), join(transaction, `${document}.md`));
			}
			io.file_content.write_text(join(transaction, "journal"), "1\nissues\nreport\nlint-output");
			const lock = join(workspace, ".task-publication-lock");
			io.directory_operations.create_directory(lock);
			io.file_content.write_text(join(lock, "owner"), `999999999\n${transaction}\n`);
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			});
			const published_rules = io.directory_entries.list_files(join(workspace, "rules"));
			return {
				lock_exists: io.file_paths.path_exists(lock),
				published_rules,
				transaction_exists: io.file_paths.path_exists(transaction),
			};
		});
		expect(result).toEqual({
			lock_exists: false,
			published_rules: ["typescript-unused-file.md"],
			transaction_exists: false,
		});
	});

	test("restores committed documents after replacement failure", () => {
		const fixture = create_reporting_fixture();
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const scenario = new TaskPublicationRecoveryScenario(fixture, reporting.batch);
		const previous = scenario.prepare(reporting);
		expect(() => scenario.fail_replacement()).toThrow("missing-staged-rules");
		expect(scenario.documents()).toEqual(previous);
	});

	test("does not replace a live publication owner", () => {
		const fixture = create_reporting_fixture();
		const { root, file_io: io } = fixture;
		const reporting = new TaskReporting(root, { file_io: io, documentation: fixture.documentation });
		reporting.format([violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const workspace = join(root, ".ai-code-guard");
		const previous = io.file_content.file_text(join(workspace, "issues.md"));
		const lock = join(workspace, ".task-publication-lock");
		io.directory_operations.create_directory(lock);
		io.file_content.write_text(join(lock, "owner"), `${process.pid}\n\nactive-token\n`);
		expect(() =>
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			}),
		).toThrow("live or unverifiable");
		expect({
			lock_exists: io.file_paths.path_exists(lock),
			issues: io.file_content.file_text(join(workspace, "issues.md")),
			previous,
		}).toEqual({
			lock_exists: true,
			issues: previous,
			previous,
		});
	});

	test("rejects a malformed abandoned journal without touching live artifacts", () => {
		const fixture = create_reporting_fixture();
		const { root, file_io: io } = fixture;
		const reporting = new TaskReporting(root, { file_io: io, documentation: fixture.documentation });
		reporting.format([violation("a.ts", 1, "parse-error", 3)], {
			batch_size: 10,
			policy: "all",
			skip_review: false,
		});
		const workspace = join(root, ".ai-code-guard");
		const transaction = io.directory_operations.temporary_directory(root, ".ai-code-guard-task-");
		io.file_content.write_text(join(transaction, "journal"), "malformed\nunknown-document");
		const lock = join(workspace, ".task-publication-lock");
		io.directory_operations.create_directory(lock);
		io.file_content.write_text(join(lock, "owner"), `999999999\n${transaction}\n`);
		const previous = io.file_content.file_text(join(workspace, "issues.md"));
		expect(() =>
			reporting.format([violation("b.ts", 1, "unused-file", 3)], {
				batch_size: 10,
				policy: "all",
				skip_review: false,
			}),
		).toThrow("journal is unavailable");
		expect({
			issues_unchanged: io.file_content.file_text(join(workspace, "issues.md")) === previous,
			lock_exists: io.file_paths.path_exists(lock),
			transaction_exists: io.file_paths.path_exists(transaction),
		}).toEqual({
			issues_unchanged: true,
			lock_exists: true,
			transaction_exists: true,
		});
	});
});
