import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import type {
	ReviewAbandonedAgentCleanupContract,
	ReviewRecoveryClaimContract,
} from "src/core/support/task/review-agent/protocols";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _stale review lock recovery_, _abandoned agent cleanup_. **/
export class ReviewRunLockRecovery {
	private readonly path: string;
	private readonly recovery_path: string;
	private readonly file_io: IOContract;
	/** Responsibilities: _abandoned lock directory discovery_. **/
	private stale_lock_paths(): string[] {
		const parent = dirname(this.path);
		const prefix = `${basename(this.path)}.stale.`;
		return this.file_io.directory_entries
			.list_entries(parent)
			.filter((entry) => entry.is_directory && entry.name.startsWith(prefix))
			.map((entry) => join(parent, entry.name))
			.sort();
	}

	/** Responsibilities: _live lock restoration_. **/
	private restore_live_lock(stale_path: string, failure_classification: SystemFailureClassificationContract): boolean {
		try {
			this.file_io.directory_operations.move_path(stale_path, this.path);
			return false;
		} catch (error) {
			if (!failure_classification.system_failure_message(String(error))) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _stale lock finalization_. **/
	private finalize_stale_lock(
		stale_path: string,
		failure_classification: SystemFailureClassificationContract,
		recovery_claim: ReviewRecoveryClaimContract,
		abandoned_agents: ReviewAbandonedAgentCleanupContract,
	): boolean {
		if (recovery_claim.owner_is_live(stale_path, failure_classification)) {
			return this.restore_live_lock(stale_path, failure_classification);
		}
		abandoned_agents.terminate(stale_path);
		this.file_io.directory_operations.remove_path(stale_path);
		return true;
	}

	/** Responsibilities: _stale lock path replacement_. **/
	private recover_stale_path(
		failure_classification: SystemFailureClassificationContract,
		recovery_claim: ReviewRecoveryClaimContract,
		abandoned_agents: ReviewAbandonedAgentCleanupContract,
	): boolean {
		if (!this.recover_stale_paths(failure_classification, recovery_claim, abandoned_agents)) {
			return false;
		}
		if (!this.file_io.file_paths.path_exists(this.path)) {
			return true;
		}
		if (recovery_claim.owner_is_live(this.path, failure_classification)) {
			return false;
		}
		const stale_path = `${this.path}.stale.${process.pid}.${randomUUID()}`;
		if (!this.stale_lock_path(stale_path, failure_classification)) {
			return false;
		}
		return this.finalize_stale_lock(stale_path, failure_classification, recovery_claim, abandoned_agents);
	}

	/** Responsibilities: _active lock archival_. **/
	private stale_lock_path(stale_path: string, failure_classification: SystemFailureClassificationContract): boolean {
		try {
			this.file_io.directory_operations.move_path(this.path, stale_path);
			return true;
		} catch (error) {
			if (!failure_classification.system_failure_message(String(error))) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _stale lock directory reconciliation_. **/
	private recover_stale_paths(
		failure_classification: SystemFailureClassificationContract,
		recovery_claim: ReviewRecoveryClaimContract,
		abandoned_agents: ReviewAbandonedAgentCleanupContract,
	): boolean {
		for (const stale_path of this.stale_lock_paths()) {
			if (!this.finalize_stale_lock(stale_path, failure_classification, recovery_claim, abandoned_agents)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _review lock recovery setup_. **/
	public constructor(path: string, recovery_path: string, file_io: IOContract) {
		this.path = path;
		this.recovery_path = recovery_path;
		this.file_io = file_io;
	}

	/** Responsibilities: _pending recovery detection_. **/
	public recovery_required(): boolean {
		if (this.file_io.file_paths.path_exists(this.recovery_path)) {
			return true;
		}
		return this.stale_lock_paths().length > 0;
	}

	/** Responsibilities: _stale lock takeover_. **/
	public recover_stale_lock(
		failure_classification: SystemFailureClassificationContract,
		recovery_claim: ReviewRecoveryClaimContract,
		abandoned_agents: ReviewAbandonedAgentCleanupContract,
	): boolean {
		if (!recovery_claim.claim(failure_classification)) {
			return false;
		}
		try {
			return this.recover_stale_path(failure_classification, recovery_claim, abandoned_agents);
		} finally {
			recovery_claim.release();
		}
	}
}
