import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import type {
	ReviewAbandonedAgentCleanupContract,
	ReviewRecoveryClaimContract,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewRunLockRecoveryOptions } from "src/core/support/task/review-agent/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _stale review lock recovery_, _abandoned agent cleanup_. **/
export class ReviewRunLockRecovery {
	private readonly _path: string;
	private readonly _file_io: IOContract;
	private readonly _failure_classification: SystemFailureClassificationContract;
	private readonly _recovery_claim: ReviewRecoveryClaimContract;
	private readonly _abandoned_agents: ReviewAbandonedAgentCleanupContract;
	/** Responsibilities: _abandoned lock directory discovery_. **/
	private stale_lock_paths(): string[] {
		const parent = dirname(this._path);
		const prefix = `${basename(this._path)}.stale.`;
		return this._file_io
			.list_entries(parent)
			.filter((entry) => entry.is_directory && entry.name.startsWith(prefix))
			.map((entry) => join(parent, entry.name))
			.sort();
	}

	/** Responsibilities: _live lock restoration_. **/
	private move_path(source_path: string, target_path: string): boolean {
		try {
			this._file_io.move_path(source_path, target_path);
			return true;
		} catch (error) {
			if (!this._failure_classification.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _stale lock finalization_. **/
	private finalize_stale_lock(stale_path: string): boolean {
		if (this._recovery_claim.owner_is_live(stale_path)) {
			this.move_path(stale_path, this._path);
			return false;
		}
		if (!this._abandoned_agents.terminate(stale_path)) {
			return false;
		}
		this._file_io.remove_path(stale_path);
		return true;
	}

	/** Responsibilities: _stale lock directory reconciliation_. **/
	private recover_stale_paths(): boolean {
		for (const stale_path of this.stale_lock_paths()) {
			if (!this.finalize_stale_lock(stale_path)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _review lock recovery setup_. **/
	public constructor(options: ReviewRunLockRecoveryOptions) {
		this._path = options.path;
		this._file_io = options.file_io;
		this._failure_classification = options.failure_classification;
		this._recovery_claim = options.recovery_claim;
		this._abandoned_agents = options.abandoned_agents;
	}

	/** Responsibilities: _pending recovery detection_. **/
	public recovery_required(): boolean {
		// The caller owns the recovery claim while checking and acting on these paths.
		return this.stale_lock_paths().length > 0;
	}

	/** Responsibilities: _stale lock takeover_. **/
	public recover_stale_lock(): boolean {
		if (!this.recover_stale_paths()) {
			return false;
		}
		if (!this._file_io.file(this._path).path_exists()) {
			return true;
		}
		if (this._recovery_claim.owner_is_live(this._path)) {
			return false;
		}
		const stale_path = `${this._path}.stale.${process.pid}.${randomUUID()}`;
		if (!this.move_path(this._path, stale_path)) {
			return false;
		}
		return this.finalize_stale_lock(stale_path);
	}
}
