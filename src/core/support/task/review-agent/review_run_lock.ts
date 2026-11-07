import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { ProcessSignalContract } from "src/analysis_protocols";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_DIRECTORY,
	REVIEW_RUN_LOCK_DIRECTORY,
} from "src/core/support/task/review-agent/constants";
import type {
	ReviewAbandonedAgentCleanupContract,
	ReviewRecoveryClaimContract,
} from "src/core/support/task/review-agent/protocols";
import { ReviewAbandonedAgentCleanup } from "src/core/support/task/review-agent/review_abandoned_agent_cleanup";
import { ReviewRecoveryClaim } from "src/core/support/task/review-agent/review_recovery_claim";
import { ReviewRunLockRecovery } from "src/core/support/task/review-agent/review_run_lock_recovery";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _review lock lifecycle_, _recovery claim coordination_. **/
export class ReviewRunLock {
	private readonly _path: string;
	private readonly _owner_tokens: Map<string, string>;
	private readonly _file_io: IOContract;
	private readonly _recovery: ReviewRunLockRecovery;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _recovery_path: string;
	private readonly _recovery_claim: ReviewRecoveryClaimContract;
	private readonly _abandoned_agents: ReviewAbandonedAgentCleanupContract;

	/** Responsibilities: _staging lock publication_. **/
	private publish_lock(): boolean {
		const staging_path = `${this._path}.${process.pid}.${randomUUID()}`;
		const token = randomUUID();
		this._file_io.create_directory_exclusive(staging_path);
		try {
			this.write_lock_owner(staging_path, token);
			this._file_io.move_path(staging_path, this._path);
			this._owner_tokens.set(this._path, token);
			return true;
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			this._file_io.remove_path(staging_path);
			return false;
		}
	}

	/** Responsibilities: _review lock owner publication_. **/
	private write_lock_owner(staging_path: string, token: string): void {
		const identity_reader = new ReviewAgentIdentity({
			pid: 0,
			start_time: "",
			boot_id: "",
			available: false,
			file_io: this._file_io,
			ownership_token: "",
		});
		const process_identity = identity_reader.from_process({ value: process.pid }).serialized();
		const [, start_time = "", boot_id = ""] = process_identity.split("\n");
		const owner_path = join(staging_path, "owner");
		const owner_text = `${process.pid}\n${token}\n${start_time}\n${boot_id}\n`;
		this._file_io.file(owner_path).write_text(owner_text);
	}

	/** Responsibilities: _existing lock acquisition_. **/
	private acquire_existing_lock(): boolean {
		if (!this._file_io.file(this._path).path_exists()) {
			return this.publish_lock();
		}
		if (!this._recovery.recover_stale_lock()) {
			return false;
		}
		return this.publish_lock();
	}

	/** Responsibilities: _claimed lock acquisition_. **/
	private acquire_with_claim(): boolean {
		if (this._recovery.recovery_required()) {
			if (!this._recovery.recover_stale_lock()) {
				return false;
			}
		}
		if (this.publish_lock()) {
			return true;
		}
		return this.acquire_existing_lock();
	}

	/** Responsibilities: _owner token lookup_. **/
	private token(): string {
		try {
			const owner_text = this._file_io.file(join(this._path, "owner")).file_text();
			const owner_lines = owner_text.split(/\r?\n/u);
			const token = owner_lines[1];
			if (token === undefined) {
				return "";
			}
			return token;
		} catch (error) {
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return "";
		}
	}

	/** Responsibilities: _review lock setup_. **/
	public constructor(root: string, file_io: IOContract, process_signal: ProcessSignalContract) {
		this._path = join(resolve(root), AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY, REVIEW_RUN_LOCK_DIRECTORY);
		this._owner_tokens = new Map<string, string>();
		this._file_io = file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._recovery_path = `${this._path}.recovery`;
		this._recovery_claim = new ReviewRecoveryClaim(
			this._recovery_path,
			file_io,
			process_signal,
			this._boundary_failures,
		);
		this._abandoned_agents = new ReviewAbandonedAgentCleanup(file_io, process_signal);
		this._recovery = new ReviewRunLockRecovery({
			path: this._path,
			file_io,
			failure_classification: this._boundary_failures,
			recovery_claim: this._recovery_claim,
			abandoned_agents: this._abandoned_agents,
		});
	}

	/** Responsibilities: _review lock acquisition_. **/
	public try_acquire(): boolean {
		this._file_io.create_directory(resolve(this._path, ".."));
		if (!this._recovery_claim.claim()) {
			return false;
		}
		try {
			return this.acquire_with_claim();
		} finally {
			this._recovery_claim.release();
		}
	}

	/** Responsibilities: _review lock cleanup_. **/
	public release(): void {
		const owner_token = this._owner_tokens.get(this._path);
		if (owner_token === undefined || this.token() !== owner_token) {
			return;
		}
		this._file_io.remove_path(this._path);
		this._owner_tokens.delete(this._path);
	}
}
