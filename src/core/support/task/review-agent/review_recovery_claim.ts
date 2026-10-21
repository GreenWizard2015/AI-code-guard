import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ProcessSignalContract, SystemFailureClassificationContract } from "src/analysis_protocols";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type { IOContract } from "src/io/protocols";
import type { ReviewRecoveryClaimContract } from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _exclusive recovery ownership_, _recovery process identity_. **/
export class ReviewRecoveryClaim implements ReviewRecoveryClaimContract {
	private readonly path: string;
	private readonly token: string;
	private readonly file_io: IOContract;
	private readonly process_signal: ProcessSignalContract;

	/** Responsibilities: _recovery owner process identity_. **/
	private identity_is_live(pid: number, start_time: string, boot_id: string): boolean {
		if (start_time.length === 0 || boot_id.length === 0) {
			return true;
		}
		const reader = new ReviewAgentIdentity(0, "", "", false, this.file_io);
		const stored = reader.stored_identity(`${pid}\n${start_time}\n${boot_id}\n`);
		const current = reader.from_process(pid);
		if (current.serialized().length === 0) {
			return true;
		}
		return stored.matches(current);
	}

	/** Responsibilities: _recovery owner record creation_. **/
	private write_owner(staging_path: string): void {
		const reader = new ReviewAgentIdentity(0, "", "", false, this.file_io);
		const current = reader.from_process(process.pid);
		const [, start_time = "", boot_id = ""] = current.serialized().split("\n");
		this.file_io.file_content.write_text(
			join(staging_path, "owner"),
			`${process.pid}\n${this.token}\n${start_time}\n${boot_id}\n`,
		);
	}

	/** Responsibilities: _stale claim reclamation_. **/
	private remove_stale_claim(failure_classification: SystemFailureClassificationContract): boolean {
		if (!this.file_io.file_paths.path_exists(this.path)) {
			return true;
		}
		if (this.owner_is_live(this.path, failure_classification)) {
			return false;
		}
		this.file_io.directory_operations.remove_path(this.path);
		return true;
	}

	/** Responsibilities: _recovery claim publication_. **/
	private publish_claim(staging_path: string, failure_classification: SystemFailureClassificationContract): boolean {
		let created = false;
		try {
			this.file_io.directory_operations.create_directory_exclusive(staging_path);
			created = true;
			this.write_owner(staging_path);
			this.file_io.directory_operations.move_path(staging_path, this.path);
			return true;
		} catch (error) {
			if (created) {
				this.file_io.directory_operations.remove_path(staging_path);
			}
			if (!failure_classification.system_failure_message(String(error))) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _recovery owner process state_. **/
	private process_record_live(owner_text: string): boolean {
		const [pid_text, , start_time = "", boot_id = ""] = owner_text.split(/\r?\n/u);
		const pid = Number(pid_text);
		if (!Number.isInteger(pid)) {
			return false;
		}
		if (pid <= 0) {
			return false;
		}
		if (!this.process_signal.pid_exists(pid)) {
			return false;
		}
		return this.identity_is_live(pid, start_time, boot_id);
	}

	/** Responsibilities: _recovery claim setup_. **/
	public constructor(path: string, file_io: IOContract, process_signal: ProcessSignalContract) {
		this.path = path;
		this.file_io = file_io;
		this.process_signal = process_signal;
		this.token = randomUUID();
	}

	/** Responsibilities: _recovery owner liveness_. **/
	public owner_is_live(path: string, failure_classification: SystemFailureClassificationContract): boolean {
		try {
			const owner_text = this.file_io.file_content.file_text(join(path, "owner"));
			return this.process_record_live(owner_text);
		} catch (error) {
			if (!failure_classification.system_failure_message(String(error))) {
				throw error;
			}
			return failure_classification.permission_denied(String(error));
		}
	}

	/** Responsibilities: _stale recovery claim removal_. **/
	public claim(failure_classification: SystemFailureClassificationContract): boolean {
		if (!this.remove_stale_claim(failure_classification)) {
			return false;
		}
		const staging_path = `${this.path}.${process.pid}.${this.token}.initializing`;
		return this.publish_claim(staging_path, failure_classification);
	}

	/** Responsibilities: _recovery claim owner validation_. **/
	public release(): void {
		if (!this.file_io.file_paths.path_exists(this.path)) {
			return;
		}
		const owner_text = this.file_io.file_content.file_text(join(this.path, "owner"));
		const owner_lines = owner_text.split(/\r?\n/u);
		if (owner_lines[1] === this.token) {
			this.file_io.directory_operations.remove_path(this.path);
		}
	}
}
