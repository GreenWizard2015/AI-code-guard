import { join } from "node:path";
import { beforeEach, describe, expect, test } from "@jest/globals";
import type { OwnedProcessGroup, ProcessGroupReference, ProcessSignalContract } from "src/analysis_protocols";
import "src/core/lint_project_context_creator";
import { ReviewRecoveryClaim } from "src/core/support/task/review-agent/review_recovery_claim";
import { ReviewRunLock } from "src/core/support/task/review-agent/review_run_lock";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ReviewRunLockProcessSignalFixture } from "tests/bridge/ts/core/support/task/review-agent/review_run_lock_process_signal_fixture";
import { ReviewClaimInterleavingFileIO } from "tests/core/support/task/review-agent/review-claim-interleaving-file-io";
import type {
	ReviewRecoveryClaimRaceFixture,
	ReviewRecoveryClaimRaceSnapshot,
} from "tests/core/support/task/review-agent/types";

describe("review recovery claim", () => {
	const root = "/virtual/review-recovery-claim";
	let file_io: InMemoryFileIO;
	let process_signal: ReviewRunLockProcessSignalFixture;

	beforeEach(() => {
		file_io = new InMemoryFileIO();
		process_signal = new ReviewRunLockProcessSignalFixture(new Set(), new Set(), true, new Set());
	});
	/** Responsibilities: _process signal fixture_. **/
	const create_process_signal = (pid_exists: ProcessSignalContract["pid_exists"]): ProcessSignalContract => ({
		pid_exists,
		group_exists: (_group: ProcessGroupReference): boolean => false,
		group_contains_token: (_ownership: OwnedProcessGroup): boolean => false,
		terminate_owned_group: (_ownership: OwnedProcessGroup): boolean => false,
		terminate_group: (_group: ProcessGroupReference): boolean => true,
	});
	/** Responsibilities: _claim race fixture creation_. **/
	const create_claim_race = (claim_path: string): ReviewRecoveryClaimRaceFixture => {
		const file_io = new ReviewClaimInterleavingFileIO(claim_path);
		file_io.create_directory(claim_path);
		const owner_path = join(claim_path, "owner");
		file_io.file(owner_path).write_text("999999999\nstale-owner\n");
		let interleaved_claim_acquired = false;
		let owner_after_interleaved_claim = "";
		const race_signal = create_process_signal(() => {
			file_io.claim_contender_once(claim_path);
			return false;
		});
		const failure_classification = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		file_io.register_contender(
			claim_path,
			new ReviewRecoveryClaim(claim_path, file_io, race_signal, failure_classification),
		);
		const interleaved_claim = new ReviewRecoveryClaim(claim_path, file_io, race_signal, failure_classification);
		file_io.before_stale_claim_move(() => {
			interleaved_claim_acquired = interleaved_claim.claim();
			owner_after_interleaved_claim = file_io.file(owner_path).file_text();
		});
		const read_state = (): ReviewRecoveryClaimRaceSnapshot => ({
			stale_contender_acquired: file_io.contender_acquired(claim_path),
			interleaved_claim_acquired,
			owner_after_interleaved_claim,
			final_owner: file_io.file(owner_path).file_text(),
		});
		return {
			file_io,
			owner_path,
			process_signal: race_signal,
			failure_classification,
			read_state,
		};
	};
	/** Responsibilities: _live claim interleaving_. **/
	const create_live_claim_race = (claim_path: string): ReviewRecoveryClaimRaceFixture => {
		const file_io = new ReviewClaimInterleavingFileIO(claim_path);
		file_io.create_directory(claim_path);
		const owner_path = join(claim_path, "owner");
		file_io.file(owner_path).write_text("999999999\nstale-owner\n");
		let interleaved_claim_acquired = false;
		let owner_after_interleaved_claim = "";
		const race_signal = create_process_signal(() => false);
		const failure_classification = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		const interleaved_claim = new ReviewRecoveryClaim(claim_path, file_io, race_signal, failure_classification);
		file_io.before_stale_claim_move(() => {
			interleaved_claim_acquired = interleaved_claim.claim();
			owner_after_interleaved_claim = file_io.file(owner_path).file_text();
		});
		const read_state = (): ReviewRecoveryClaimRaceSnapshot => ({
			stale_contender_acquired: false,
			interleaved_claim_acquired,
			owner_after_interleaved_claim,
			final_owner: file_io.file(owner_path).file_text(),
		});
		return {
			file_io,
			owner_path,
			process_signal: race_signal,
			failure_classification,
			read_state,
		};
	};

	test("recognizes that a recovery lock PID belongs to a different process incarnation", () => {
		const recovery_path = join(root, ".ai-code-guard", "review", ".review-run-lock.recovery");
		const boot_id = "test-boot";
		file_io.seed_files(
			new Map([
				[`/proc/${process.pid}/stat`, `1 (node) ${Array.from({ length: 19 }, () => "0").join(" ")} current-start\n`],
				["/proc/sys/kernel/random/boot_id", `${boot_id}\n`],
			]),
		);
		file_io.create_directory(recovery_path);
		file_io.file(join(recovery_path, "owner")).write_text(`${process.pid}\nrecovery-token\nold-start\n${boot_id}\n`);
		const process_signal = new ReviewRunLockProcessSignalFixture(new Set([process.pid]), new Set(), true, new Set());
		const lock = new ReviewRunLock(root, file_io, process_signal);
		const acquired = lock.try_acquire();
		lock.release();

		expect(acquired).toBe(true);
	});

	test("preserves a replacement claim acquired during a stale-owner check", () => {
		const claim_path = join(root, ".ai-code-guard", "review", ".review-run-lock.recovery");
		const race = create_claim_race(claim_path);
		const contender = new ReviewRecoveryClaim(
			claim_path,
			race.file_io,
			race.process_signal,
			race.failure_classification,
		);
		const contender_acquired = contender.claim();
		const race_state = race.read_state();

		expect({
			claims_acquired:
				Number(race_state.stale_contender_acquired) +
				Number(race_state.interleaved_claim_acquired) +
				Number(contender_acquired),
			replacement_owner_recorded:
				race_state.interleaved_claim_acquired && race_state.owner_after_interleaved_claim.length > 0,
			final_owner_matches_replacement: race_state.final_owner === race_state.owner_after_interleaved_claim,
			final_owner_process_id: race_state.final_owner.slice(0, race_state.final_owner.indexOf("\n")),
		}).toEqual({
			claims_acquired: 1,
			replacement_owner_recorded: true,
			final_owner_matches_replacement: true,
			final_owner_process_id: String(process.pid),
		});
	});

	test("does not remove a live claim installed after the final stale-owner check", () => {
		const claim_path = join(root, ".ai-code-guard", "review", ".review-run-lock.recovery");
		const race = create_live_claim_race(claim_path);
		const contender_b = new ReviewRecoveryClaim(
			claim_path,
			race.file_io,
			race.process_signal,
			race.failure_classification,
		);
		const contender_b_acquired = contender_b.claim();
		const race_state = race.read_state();
		expect({
			claims_acquired: Number(race_state.interleaved_claim_acquired) + Number(contender_b_acquired),
			replacement_owner_recorded:
				race_state.interleaved_claim_acquired && race_state.owner_after_interleaved_claim.length > 0,
			final_owner_matches_replacement: race_state.final_owner === race_state.owner_after_interleaved_claim,
			final_owner_process_id: race_state.final_owner.slice(0, race_state.final_owner.indexOf("\n")),
		}).toEqual({
			claims_acquired: 1,
			replacement_owner_recorded: true,
			final_owner_matches_replacement: true,
			final_owner_process_id: String(process.pid),
		});
	});

	test("refuses to reclaim an ownerless directory", () => {
		const claim_path = join(root, ".ai-code-guard", "review", ".review-run-lock.recovery");
		const race_file_io = new ReviewClaimInterleavingFileIO(claim_path);
		race_file_io.create_directory(claim_path);
		const race_process_signal = create_process_signal(() => false);
		const failure_classification = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		const contender = new ReviewRecoveryClaim(claim_path, race_file_io, race_process_signal, failure_classification);
		let move_boundary_reached = false;
		race_file_io.before_stale_claim_move(() => {
			move_boundary_reached = true;
		});

		const result = {
			acquired: contender.claim(),
			move_boundary_reached,
			claim_directory_empty: race_file_io.list_entries(claim_path).length === 0,
		};
		expect(result).toEqual({ acquired: false, move_boundary_reached: false, claim_directory_empty: true });
	});

	test("retains stale metadata while an unverified agent group remains alive", () => {
		const lock_path = join(root, ".ai-code-guard", "review", ".review-run-lock");
		const agents_path = join(lock_path, "agents");
		file_io.create_directory(agents_path);
		file_io.file(join(lock_path, "owner")).write_text("999999999\nstale-owner\n");
		file_io.file(join(agents_path, "4321")).write_text("4321\nold-start\nold-boot\n");
		process_signal = new ReviewRunLockProcessSignalFixture(new Set(), new Set([4321]), true, new Set());
		const lock = new ReviewRunLock(root, file_io, process_signal);
		const acquired = lock.try_acquire();
		const stale_paths = file_io
			.list_entries(join(root, ".ai-code-guard", "review"))
			.filter((entry) => entry.name.startsWith(".review-run-lock.stale."));

		expect({
			acquired,
			stale_lock_retained: stale_paths.length === 1,
			agent_identity_retained: stale_paths.some((entry) =>
				file_io.file(join(root, ".ai-code-guard", "review", entry.name, "agents", "4321")).path_exists(),
			),
			terminated: process_signal.termination_signals(),
		}).toEqual({ acquired: false, stale_lock_retained: true, agent_identity_retained: true, terminated: [] });
	});
});
