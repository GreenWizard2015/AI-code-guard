import { join } from "node:path";
import type { TaskPublicationOwnerContract } from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _recovery claim acquisition_, _stale claim reclamation_. **/
export class TaskPublicationRecoveryClaim {
	private readonly lock_path: string;
	private readonly owner_token: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _process liveness_. **/
	private process_live(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch (error) {
			const message = String(error);
			if (message.includes("ESRCH")) {
				return false;
			}
			if (message.includes("EPERM")) {
				return true;
			}
			throw error;
		}
	}

	/** Responsibilities: _stale claim detection_. **/
	private stale_claim(path: string): boolean {
		const claim_owner = join(path, "owner");
		if (this.file_io.directory_entries.path_kind(claim_owner) !== "file") {
			return true;
		}
		const [pid_text] = this.file_io.file_content.file_text(claim_owner).split("\n");
		const pid = Number(pid_text);
		if (!Number.isInteger(pid)) {
			return true;
		}
		if (pid <= 0) {
			return true;
		}
		return !this.process_live(pid);
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
			void cleanup_error;
		}
	}

	/** Responsibilities: _recovery claim initialization_. **/
	public constructor(lock_path: string, owner_token: string, file_io: IOContract) {
		this.lock_path = lock_path;
		this.owner_token = owner_token;
		this.file_io = file_io;
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
		let created = false;
		try {
			this.file_io.directory_operations.create_directory_exclusive(path);
			created = true;
			this.file_io.file_content.write_text(join(path, "owner"), `${process.pid}\n${this.owner_token}\n`);
		} catch (error) {
			this.cleanup_failed_claim(path, created);
			throw new Error(`Task publication recovery claim failed: ${this.lock_path} (${String(error)})`);
		}
	}
}
