import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_DIRECTORY,
	REVIEW_RUN_LOCK_DIRECTORY,
} from "src/core/support/task/review-agent/constants";
import { ReviewRunLockRecovery } from "src/core/support/task/review-agent/review_run_lock_recovery";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type { IOContract } from "src/io/protocols";
import type { ProcessSignalContract } from "src/analysis_protocols";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { ReviewRecoveryClaim } from "src/core/support/task/review-agent/review_recovery_claim";
import { ReviewAbandonedAgentCleanup } from "src/core/support/task/review-agent/review_abandoned_agent_cleanup";
import type {
	ReviewAbandonedAgentCleanupContract,
	ReviewRecoveryClaimContract,
} from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _single review process ownership_, _lock lifecycle_. **/
export class ReviewRunLock {
	private readonly path: string;
	private readonly owner_tokens: Map<string, string>;
	private readonly file_io: IOContract;
	private readonly recovery: ReviewRunLockRecovery;
	private readonly boundary_failures: BoundaryFailureClassifier;
	private readonly recovery_path: string;
	private readonly recovery_claim: ReviewRecoveryClaimContract;
	private readonly abandoned_agents: ReviewAbandonedAgentCleanupContract;

	/** Responsibilities: _staging lock publication_. **/
	private publish_lock(): boolean {
		const staging_path = `${this.path}.${process.pid}.${randomUUID()}`;
		const token = randomUUID();
		this.file_io.directory_operations.create_directory_exclusive(staging_path);
		try {
			this.write_lock_owner(staging_path, token);
			this.file_io.directory_operations.move_path(staging_path, this.path);
			this.owner_tokens.set(this.path, token);
			return true;
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
			this.file_io.directory_operations.remove_path(staging_path);
			return false;
		}
	}

	/** Responsibilities: _review lock owner publication_. **/
	private write_lock_owner(staging_path: string, token: string): void {
		const identity_reader = new ReviewAgentIdentity(0, "", "", false, this.file_io);
		const process_identity = identity_reader.from_process(process.pid).serialized();
		const [, start_time = "", boot_id = ""] = process_identity.split("\n");
		const owner_path = join(staging_path, "owner");
		const owner_text = `${process.pid}\n${token}\n${start_time}\n${boot_id}\n`;
		this.file_io.file_content.write_text(owner_path, owner_text);
	}

	/** Responsibilities: _existing lock acquisition_. **/
	private acquire_existing_lock(): boolean {
		if (!this.file_io.file_paths.path_exists(this.path)) {
			return this.publish_lock();
		}
		if (!this.recovery.recover_stale_lock(this.boundary_failures, this.recovery_claim, this.abandoned_agents)) {
			return false;
		}
		return this.publish_lock();
	}

	/** Responsibilities: _owner token lookup_. **/
	private token(): string {
		try {
			const owner_text = this.file_io.file_content.file_text(join(this.path, "owner"));
			const owner_lines = owner_text.split(/\r?\n/u);
			const token = owner_lines[1];
			if (token === undefined) {
				return "";
			}
			return token;
		} catch (error) {
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
			return "";
		}
	}

	/** Responsibilities: _review lock setup_. **/
	public constructor(root: string, file_io: IOContract, process_signal: ProcessSignalContract) {
		this.path = join(resolve(root), AI_CODE_GUARD_DIRECTORY, REVIEW_DIRECTORY, REVIEW_RUN_LOCK_DIRECTORY);
		this.owner_tokens = new Map<string, string>();
		this.file_io = file_io;
		this.boundary_failures = new BoundaryFailureClassifier();
		this.recovery_path = `${this.path}.recovery`;
		this.recovery_claim = new ReviewRecoveryClaim(this.recovery_path, file_io, process_signal);
		this.abandoned_agents = new ReviewAbandonedAgentCleanup(file_io, process_signal);
		this.recovery = new ReviewRunLockRecovery(this.path, this.recovery_path, file_io);
	}

	/** Responsibilities: _review lock acquisition_. **/
	public try_acquire(): boolean {
		this.file_io.directory_operations.create_directory(resolve(this.path, ".."));
		if (this.recovery.recovery_required()) {
			if (this.recovery_claim.owner_is_live(this.recovery_path, this.boundary_failures)) {
				return false;
			}
			if (!this.recovery.recover_stale_lock(this.boundary_failures, this.recovery_claim, this.abandoned_agents)) {
				return false;
			}
		}
		if (this.publish_lock()) {
			return true;
		}
		if (this.acquire_existing_lock()) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _review lock cleanup_. **/
	public release(): void {
		const owner_token = this.owner_tokens.get(this.path);
		if (owner_token === undefined || this.token() !== owner_token) {
			return;
		}
		this.file_io.directory_operations.remove_path(this.path);
		this.owner_tokens.delete(this.path);
	}
}
