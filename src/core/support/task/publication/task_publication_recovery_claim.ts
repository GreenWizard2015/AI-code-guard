import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { TaskPublicationOwnerContract } from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";

/** Responsibilities: _recovery claim acquisition_, _stale claim reclamation_. **/
export class TaskPublicationRecoveryClaim {
	private readonly lock_path: string;
	private readonly owner_token: string;
	private readonly file_io: IOContract;
	private readonly boundary_failures: BoundaryFailureClassifier;

	/** Responsibilities: _process liveness_. **/
	private process_live(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch (error) {
			const message = String(error);
			if (!this.boundary_failures.system_failure_message(message)) {
				throw error;
			}
			if (this.boundary_failures.missing_process(message)) {
				return false;
			}
			if (this.boundary_failures.permission_denied(message)) {
				return true;
			}
			throw error;
		}
	}

	/** Responsibilities: _stale claim detection_. **/
	private identity_mismatch(pid: number, start_time: string, boot_id: string): boolean {
		if (start_time.length === 0 || boot_id.length === 0) {
			return false;
		}
		const identity_reader = new ReviewAgentIdentity(pid, "", "", false, this.file_io);
		const stored_text = `${pid}\n${start_time}\n${boot_id}\n`;
		const stored = identity_reader.stored_identity(stored_text);
		const current = identity_reader.from_process(pid);
		if (current.serialized().length === 0) {
			return false;
		}
		return !stored.matches(current);
	}

	/** Responsibilities: _stale claim detection_. **/
	private owner_record_stale(owner_text: string): boolean {
		const [pid_text, , start_time = "", boot_id = ""] = owner_text.split("\n");
		const pid = Number(pid_text);
		if (!Number.isInteger(pid)) {
			return true;
		}
		if (pid <= 0) {
			return true;
		}
		if (!this.process_live(pid)) {
			return true;
		}
		return this.identity_mismatch(pid, start_time, boot_id);
	}

	/** Responsibilities: _stale claim detection_. **/
	private stale_claim(path: string): boolean {
		const claim_owner = join(path, "owner");
		if (!this.file_io.directory_entries.path_is_file(claim_owner)) {
			return true;
		}
		const owner_text = this.file_io.file_content.file_text(claim_owner);
		return this.owner_record_stale(owner_text);
	}

	/** Responsibilities: _stale claim removal_. **/
	private remove_existing_claim(path: string): void {
		if (!this.file_io.file_paths.path_exists(path)) {
			return;
		}
		if (!this.stale_claim(path)) {
			throw new Error(`Task publication lock recovery is already in progress: ${this.lock_path}`);
		}
		this.file_io.directory_operations.remove_path(path);
	}

	/** Responsibilities: _failed claim cleanup_. **/
	private cleanup_failed_claim(path: string, created: boolean): void {
		if (!created) {
			return;
		}
		try {
			this.file_io.directory_operations.remove_path(path);
		} catch (cleanup_error) {
			if (!this.boundary_failures.system_failure_message(String(cleanup_error))) {
				throw cleanup_error;
			}
			void cleanup_error;
		}
	}

	/** Responsibilities: _recovery claim owner publication_. **/
	private write_claim_owner(staging_path: string): void {
		const identity_reader = new ReviewAgentIdentity(0, "", "", false, this.file_io);
		const process_identity = identity_reader.from_process(process.pid).serialized();
		const [, start_time = "", boot_id = ""] = process_identity.split("\n");
		const owner_path = join(staging_path, "owner");
		const owner_text = `${process.pid}\n${this.owner_token}\n${start_time}\n${boot_id}\n`;
		this.file_io.file_content.write_text(owner_path, owner_text);
	}

	/** Responsibilities: _recovery claim initialization_. **/
	public constructor(lock_path: string, owner_token: string, file_io: IOContract) {
		this.lock_path = lock_path;
		this.owner_token = owner_token;
		this.file_io = file_io;
		this.boundary_failures = new BoundaryFailureClassifier();
	}

	/** Responsibilities: _owner identity comparison_. **/
	public same_owner(expected: TaskPublicationOwnerContract, actual: TaskPublicationOwnerContract): boolean {
		if (!expected.same_token(actual)) {
			return false;
		}
		return expected.abandoned_transaction() === actual.abandoned_transaction();
	}

	/** Responsibilities: _recovery claim initialization_. **/
	public claim(path: string): void {
		this.remove_existing_claim(path);
		const staging_path = `${path}.${process.pid}.${randomUUID()}.initializing`;
		let created = false;
		try {
			this.file_io.directory_operations.create_directory_exclusive(staging_path);
			created = true;
			this.write_claim_owner(staging_path);
			this.file_io.directory_operations.move_path(staging_path, path);
		} catch (error) {
			this.cleanup_failed_claim(staging_path, created);
			if (!this.boundary_failures.system_failure_message(String(error))) {
				throw error;
			}
			throw new Error(`Task publication recovery claim failed: ${this.lock_path} (${String(error)})`);
		}
	}
}
