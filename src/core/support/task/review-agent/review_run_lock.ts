import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_DIRECTORY,
	REVIEW_RUN_LOCK_DIRECTORY,
} from "src/core/support/task/review-agent/constants";
import { ReviewRunLockRecovery } from "src/core/support/task/review-agent/review_run_lock_recovery";
import type { IOContract } from "src/io/protocols";
import type { ProcessSignalContract } from "src/analysis_protocols";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";

/** Responsibilities: _single review process ownership_, _lock lifecycle_. **/
export class ReviewRunLock {
	private readonly path: string;
	private readonly owner_tokens: Map<string, string>;
	private readonly file_io: IOContract;
	private readonly recovery: ReviewRunLockRecovery;
	private readonly boundary_failures: BoundaryFailureClassifier;

	/** Responsibilities: _staging lock publication_. **/
	private publish_lock(): boolean {
		const staging_path = `${this.path}.${process.pid}.${randomUUID()}`;
		const token = randomUUID();
		this.file_io.directory_operations.create_directory_exclusive(staging_path);
		try {
			this.file_io.file_content.write_text(join(staging_path, "owner"), `${process.pid}\n${token}\n`);
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

	/** Responsibilities: _existing lock acquisition_. **/
	private acquire_existing_lock(): boolean {
		if (!this.file_io.file_paths.path_exists(this.path)) {
			return this.publish_lock();
		}
		if (!this.recovery.recover_stale_lock(this.boundary_failures)) {
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
		this.recovery = new ReviewRunLockRecovery(this.path, `${this.path}.recovery`, file_io, process_signal);
	}

	/** Responsibilities: _review lock acquisition_. **/
	public try_acquire(): boolean {
		this.file_io.directory_operations.create_directory(resolve(this.path, ".."));
		if (this.recovery.recovery_required()) {
			if (this.recovery.recovery_is_live(this.boundary_failures)) {
				return false;
			}
			if (!this.recovery.recover_stale_lock(this.boundary_failures)) {
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
