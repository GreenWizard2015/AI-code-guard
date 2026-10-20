import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "@jest/globals";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ReviewRunLock } from "src/core/support/task/review-agent/review_run_lock";
import { ReviewRunLockFixture } from "tests/bridge/ts/core/support/task/review-agent/review-run-lock-fixture";
import { ReviewRunLockProcessSignalFixture } from "tests/bridge/ts/core/support/task/review-agent/review_run_lock_process_signal_fixture";

describe("review run lock", () => {
	const root = "/virtual/review-run-lock";
	let file_io: InMemoryFileIO;
	let process_signal: ReviewRunLockProcessSignalFixture;

	beforeEach(() => {
		file_io = new InMemoryFileIO();
		process_signal = new ReviewRunLockProcessSignalFixture(new Set(), new Set());
	});

	test("recovers a lock directory left without an owner", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		file_io.directory_operations.create_directory(lock_path);
		const lock = new ReviewRunLock(root, file_io, process_signal);

		lock.try_acquire();
		lock.release();

		expect(file_io.file_paths.path_exists(lock_path)).toBe(false);
	});

	test("does not release another owner's replacement lock", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const lock = new ReviewRunLock(root, file_io, process_signal);
		lock.try_acquire();
		file_io.file_content.write_text(join(lock_path, "owner"), "999999999\nother-owner\n");

		lock.release();

		expect(file_io.file_paths.path_exists(lock_path)).toBe(true);
	});

	test("does not publish while another owner is recovering a stale lock", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const recovery_path = `${lock_path}.recovery`;
		file_io.directory_operations.create_directory(recovery_path);
		file_io.file_content.write_text(join(recovery_path, "owner"), `${process.pid}\n`);
		const live_process_signal = new ReviewRunLockProcessSignalFixture(new Set([process.pid]), new Set());
		const lock = new ReviewRunLock(root, file_io, live_process_signal);

		expect(lock.try_acquire()).toBe(false);
		expect(file_io.file_paths.path_exists(lock_path)).toBe(false);
	});

	test("recovers a stale owner and publishes a new owner", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		file_io.directory_operations.create_directory(lock_path);
		file_io.file_content.write_text(join(lock_path, "owner"), "999999999\nstale-owner\n");
		const lock = new ReviewRunLock(root, file_io, process_signal);

		lock.try_acquire();
		lock.release();

		expect(file_io.file_paths.path_exists(lock_path)).toBe(false);
	});

	test("does not terminate a recycled agent with a different process identity", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const process_fixture = new ReviewRunLockFixture();
		const process_watch = process_fixture.watch_recycled_agent(root, file_io);
		const lock = new ReviewRunLock(root, file_io, process_signal);

		lock.try_acquire();
		process_watch.restore();

		expect(process_watch.terminated_pids).not.toContain(-4321);
		expect(file_io.file_paths.path_exists(lock_path)).toBe(true);
	});

	test("terminates an abandoned agent group when its registered leader has exited", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const agents_path = join(lock_path, "agents");
		file_io.directory_operations.create_directory(agents_path);
		file_io.file_content.write_text(join(lock_path, "owner"), "999999999\nstale-owner\n");
		file_io.file_content.write_text(join(agents_path, "4321"), "4321\nold-start\nold-boot\n");
		const process_signal = new ReviewRunLockProcessSignalFixture(new Set(), new Set([4321]));
		const lock = new ReviewRunLock(root, file_io, process_signal);
		lock.try_acquire();
		lock.release();

		expect(process_signal.terminated_signals).toEqual(["4321:SIGTERM", "4321:SIGKILL"]);
	});

	test("finishes an interrupted stale-lock retirement before publishing a new lock", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const recovery_path = `${lock_path}.recovery`;
		const stale_path = `${lock_path}.stale.1234.recovery-token`;
		file_io.directory_operations.create_directory(recovery_path);
		file_io.file_content.write_text(join(recovery_path, "owner"), "999999999\n");
		file_io.file_content.write_text(join(recovery_path, "stale-lock-path"), `${stale_path}\n`);
		file_io.directory_operations.create_directory(stale_path);
		file_io.file_content.write_text(join(stale_path, "owner"), "999999998\nabandoned\n");
		const lock = new ReviewRunLock(root, file_io, process_signal);

		lock.try_acquire();
		const stale_path_remains = file_io.file_paths.path_exists(stale_path);
		lock.release();

		expect(stale_path_remains).toBe(false);
	});
});
