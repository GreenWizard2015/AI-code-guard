import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "@jest/globals";
import { ReviewRunLock } from "src/core/support/task/review-agent/review_run_lock";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ReviewRunLockProcessSignalFixture } from "tests/bridge/ts/core/support/task/review-agent/review_run_lock_process_signal_fixture";
import { ReviewLockAcquisitionInterleavingScenario } from "tests/core/support/task/review-agent/review_lock_acquisition_interleaving_scenario";

describe("review run lock recovery", () => {
	const root = "/virtual/review-run-lock";
	let file_io: InMemoryFileIO;
	let process_signal: ReviewRunLockProcessSignalFixture;

	beforeEach(() => {
		file_io = new InMemoryFileIO();
		process_signal = new ReviewRunLockProcessSignalFixture(new Set(), new Set(), true, new Set());
	});
	/** Responsibilities: _lock owner fixture_. **/
	const seed_lock_owner = (lock_path: string, owner_record: string): void => {
		file_io.create_directory(lock_path);
		file_io.file(join(lock_path, "owner")).write_text(owner_record);
	};
	/** Responsibilities: _stale path retirement fixture_. **/
	const seed_stale_path_retirement = (recovery_path: string, stale_path: string): void => {
		file_io.create_directory(recovery_path);
		file_io.file(join(recovery_path, "owner")).write_text("999999999\n");
		file_io.file(join(recovery_path, "stale-lock-path")).write_text(`${stale_path}\n`);
		file_io.create_directory(stale_path);
		file_io.file(join(stale_path, "owner")).write_text("999999998\nabandoned\n");
	};

	test("recovers a lock directory left without an owner", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		file_io.create_directory(lock_path);
		const lock = new ReviewRunLock(root, file_io, process_signal);
		lock.try_acquire();
		lock.release();
		const lock_remains = file_io.file(lock_path).path_exists();
		expect(lock_remains).toBe(false);
	});

	test("does not release another owner's replacement lock", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const lock = new ReviewRunLock(root, file_io, process_signal);
		lock.try_acquire();
		file_io.file(join(lock_path, "owner")).write_text("999999999\nother-owner\n");
		lock.release();
		const replacement_remains = file_io.file(lock_path).path_exists();
		expect(replacement_remains).toBe(true);
	});

	test("does not publish while another owner recovers a stale lock", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const recovery_path = `${lock_path}.recovery`;
		seed_lock_owner(recovery_path, `${process.pid}\n`);
		const recovering_owner_signal = new ReviewRunLockProcessSignalFixture(
			new Set([process.pid]),
			new Set(),
			true,
			new Set(),
		);
		const lock = new ReviewRunLock(root, file_io, recovering_owner_signal);
		const acquired = lock.try_acquire();
		const canonical_lock_exists = file_io.file(lock_path).path_exists();
		expect({ acquired, canonical_lock_exists }).toEqual({ acquired: false, canonical_lock_exists: false });
	});

	test("reclaims a stale owner and publishes a new lock", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		seed_lock_owner(lock_path, "999999999\nstale-owner\n");
		const lock = new ReviewRunLock(root, file_io, process_signal);
		lock.try_acquire();
		lock.release();
		const lock_remains = file_io.file(lock_path).path_exists();
		expect(lock_remains).toBe(false);
	});

	test("blocks a contender while the recovery claim is active", () => {
		const file_io = new ReviewLockAcquisitionInterleavingScenario(root);
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const recovery_path = `${lock_path}.recovery`;
		const process_signal = new ReviewRunLockProcessSignalFixture(new Set([process.pid]), new Set(), true, new Set());
		const recovery_lock = new ReviewRunLock(root, file_io, process_signal);
		const contender_lock = new ReviewRunLock(root, file_io, process_signal);
		let recovery_guard_active = false;
		let contender_acquired = true;
		file_io.observe_recovery_claim(() => {
			recovery_guard_active = file_io.file(join(recovery_path, "owner")).path_exists();
			contender_acquired = contender_lock.try_acquire();
		});
		recovery_lock.try_acquire();
		recovery_lock.release();
		expect({ recovery_guard_active, contender_acquired }).toEqual({
			recovery_guard_active: true,
			contender_acquired: false,
		});
	});

	test("preserves stale ownership while a contender is blocked", () => {
		const file_io = new ReviewLockAcquisitionInterleavingScenario(root);
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const stale_owner_text = "999999999\nstale-owner\n";
		const process_signal = new ReviewRunLockProcessSignalFixture(new Set([process.pid]), new Set(), true, new Set());
		const recovery_lock = new ReviewRunLock(root, file_io, process_signal);
		const contender_lock = new ReviewRunLock(root, file_io, process_signal);
		let contender_acquired = true;
		let stale_owner_unchanged = false;
		file_io.observe_recovery_claim(() => {
			contender_acquired = contender_lock.try_acquire();
			stale_owner_unchanged = file_io.file(join(lock_path, "owner")).file_text() === stale_owner_text;
		});
		recovery_lock.try_acquire();
		recovery_lock.release();
		expect({ contender_acquired, stale_owner_unchanged }).toEqual({
			contender_acquired: false,
			stale_owner_unchanged: true,
		});
	});

	test("publishes and releases the recovery claim around stale-lock recovery", () => {
		const file_io = new ReviewLockAcquisitionInterleavingScenario(root);
		const recovery_path = join(root, ".ai-code-guard", "review", ".review-run-lock.recovery");
		const process_signal = new ReviewRunLockProcessSignalFixture(new Set([process.pid]), new Set(), true, new Set());
		const recovery_lock = new ReviewRunLock(root, file_io, process_signal);
		const acquired = recovery_lock.try_acquire();
		const claim_published = file_io.recovery_claim_published();
		recovery_lock.release();
		const claim_released = !file_io.file(recovery_path).path_exists();

		expect({ acquired, claim_published, claim_released }).toEqual({
			acquired: true,
			claim_published: true,
			claim_released: true,
		});
	});

	test("rejects a contender during stale-path retirement", () => {
		const file_io = new ReviewLockAcquisitionInterleavingScenario(root);
		const process_signal = new ReviewRunLockProcessSignalFixture(new Set([process.pid]), new Set(), true, new Set());
		const recovery_lock = new ReviewRunLock(root, file_io, process_signal);
		const contender_lock = new ReviewRunLock(root, file_io, process_signal);
		let contender_acquired = true;
		file_io.observe_recovery_claim(() => {
			contender_acquired = contender_lock.try_acquire();
		});
		recovery_lock.try_acquire();
		recovery_lock.release();

		expect({ contender_acquired, claim_published: file_io.recovery_claim_published() }).toEqual({
			contender_acquired: false,
			claim_published: true,
		});
	});

	test("retires stale paths before publishing the replacement lock", () => {
		const file_io = new ReviewLockAcquisitionInterleavingScenario(root);
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const recovery_path = `${lock_path}.recovery`;
		const recovery_lock = new ReviewRunLock(root, file_io, process_signal);
		const acquired_by_recovery = recovery_lock.try_acquire();
		const canonical_lock_exists = file_io.file(lock_path).path_exists();
		const recovery_guard_released = !file_io.file(recovery_path).path_exists();
		const stale_entries = file_io
			.list_entries(join(root, ".ai-code-guard", "review"))
			.filter((entry) => entry.name.startsWith(".review-run-lock.stale."));
		recovery_lock.release();
		expect({
			acquired_by_recovery,
			canonical_lock_exists,
			recovery_guard_released,
			stale_paths_remaining: stale_entries.length,
		}).toEqual({
			acquired_by_recovery: true,
			canonical_lock_exists: true,
			recovery_guard_released: true,
			stale_paths_remaining: 0,
		});
	});

	test("finishes stale-lock retirement before publishing a new lock", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const recovery_path = `${lock_path}.recovery`;
		const stale_path = `${lock_path}.stale.1234.recovery-token`;
		seed_stale_path_retirement(recovery_path, stale_path);
		const lock = new ReviewRunLock(root, file_io, process_signal);
		lock.try_acquire();
		const stale_path_remains = file_io.file(stale_path).path_exists();
		lock.release();
		expect(stale_path_remains).toBe(false);
	});
});
