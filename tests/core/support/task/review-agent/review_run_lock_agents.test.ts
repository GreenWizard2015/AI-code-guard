import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "@jest/globals";
import { ReviewRunLock } from "src/core/support/task/review-agent/review_run_lock";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ReviewRunLockProcessSignalFixture } from "tests/bridge/ts/core/support/task/review-agent/review_run_lock_process_signal_fixture";

describe("review run lock agent ownership", () => {
	const root = "/virtual/review-run-lock";
	let file_io: InMemoryFileIO;
	let process_signal: ReviewRunLockProcessSignalFixture;

	beforeEach(() => {
		file_io = new InMemoryFileIO();
		process_signal = new ReviewRunLockProcessSignalFixture(new Set(), new Set(), true, new Set());
	});

	/** Responsibilities: _failed agent termination fixture_. **/
	const prepare_failed_termination = (): ReviewRunLockProcessSignalFixture => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const stat_fields = Array.from({ length: 19 }, () => "0");
		stat_fields.push("agent-start");
		file_io.seed_files(
			new Map([
				["/proc/4321/stat", `4321 (agent) ${stat_fields.join(" ")}\n`],
				["/proc/sys/kernel/random/boot_id", "current-boot\n"],
			]),
		);
		file_io.create_directory(lock_path);
		file_io.file(join(lock_path, "owner")).write_text("999999999\nstale-owner\n");
		const agents_path = join(lock_path, "agents");
		file_io.create_directory(agents_path);
		file_io.file(join(agents_path, "4321")).write_text("4321\nagent-start\ncurrent-boot\n");
		return new ReviewRunLockProcessSignalFixture(new Set(), new Set([4321]), false, new Set());
	};

	test("does not terminate an agent group without matching ownership", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const lock = new ReviewRunLock(root, file_io, process_signal);
		lock.try_acquire();
		const result = {
			terminated_signals: process_signal.termination_signals(),
			lock_exists: file_io.file(lock_path).path_exists(),
		};
		expect(result).toEqual({ terminated_signals: [], lock_exists: true });
	});

	test("leaves an abandoned group untouched when its leader identity is unavailable", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const agents_path = join(lock_path, "agents");
		file_io.create_directory(agents_path);
		file_io.file(join(lock_path, "owner")).write_text("999999999\nstale-owner\n");
		file_io.file(join(agents_path, "4321")).write_text("4321\nold-start\nold-boot\n");
		const unavailable_leader_signal = new ReviewRunLockProcessSignalFixture(new Set(), new Set(), true, new Set());
		const lock = new ReviewRunLock(root, file_io, unavailable_leader_signal);
		lock.try_acquire();
		lock.release();
		const terminated_signals = unavailable_leader_signal.termination_signals();
		expect(terminated_signals).toEqual([]);
	});

	test("reclaims an orphaned group when a surviving member proves ownership", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const agents_path = join(lock_path, "agents");
		const ownership_token = "review-run-token";
		file_io.create_directory(agents_path);
		file_io.file(join(lock_path, "owner")).write_text("999999999\nstale-owner\n");
		file_io.file(join(agents_path, "4321")).write_text(`4321\nold-start\nold-boot\n${ownership_token}\n`);
		const surviving_member_signal = new ReviewRunLockProcessSignalFixture(
			new Set(),
			new Set([4321]),
			true,
			new Set([`4321:${ownership_token}`]),
		);
		const lock = new ReviewRunLock(root, file_io, surviving_member_signal);
		const acquired = lock.try_acquire();
		lock.release();
		const termination_count = surviving_member_signal.termination_signals().length;
		expect({ acquired, termination_count }).toEqual({ acquired: true, termination_count: 2 });
	});

	test("does not acquire the lock when verified termination fails", () => {
		const lock = new ReviewRunLock(root, file_io, prepare_failed_termination());

		expect(lock.try_acquire()).toBe(false);
	});

	test("retains the stale lock after termination fails", () => {
		const lock = new ReviewRunLock(root, file_io, prepare_failed_termination());
		lock.try_acquire();
		const stale_entries = file_io
			.list_entries(join(root, ".ai-code-guard", "review"))
			.filter((entry) => entry.name.startsWith(".review-run-lock.stale."));

		expect(stale_entries).toHaveLength(1);
	});

	test("retains the agent identity after termination fails", () => {
		const lock = new ReviewRunLock(root, file_io, prepare_failed_termination());
		lock.try_acquire();
		const stale_entries = file_io
			.list_entries(join(root, ".ai-code-guard", "review"))
			.filter((entry) => entry.name.startsWith(".review-run-lock.stale."));
		const agent_identity_retained = stale_entries.some((entry) =>
			file_io.file(join(root, ".ai-code-guard", "review", entry.name, "agents", "4321")).path_exists(),
		);

		expect(agent_identity_retained).toBe(true);
	});
});
