import { join, resolve } from "node:path";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_AGENT_DIRECTORY,
	REVIEW_DIRECTORY,
	REVIEW_RUN_LOCK_DIRECTORY,
} from "src/core/support/task/review-agent/constants";
import type { ReviewAgentIdentityContract } from "src/core/support/task/review-agent/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _process identity_, _agent identity storage_. **/
export class ReviewAgentIdentity implements ReviewAgentIdentityContract {
	private readonly pid: number;
	private readonly start_time: string;
	private readonly boot_id: string;
	private readonly available: boolean;
	private readonly file_io: IOContract;

	/** Responsibilities: _identity from process fields_. **/
	private process_fields(pid: number, fields: readonly string[], boot_id: string): ReviewAgentIdentityContract {
		const start_time = fields.slice(19, 20).join("");
		if (start_time.length === 0 || boot_id.length === 0) {
			return new ReviewAgentIdentity(pid, "", "", false, this.file_io);
		}
		return new ReviewAgentIdentity(pid, start_time, boot_id, true, this.file_io);
	}

	/** Responsibilities: _review-agent identity state_. **/
	public constructor(pid: number, start_time: string, boot_id: string, available: boolean, file_io: IOContract) {
		this.pid = pid;
		this.start_time = start_time;
		this.boot_id = boot_id;
		this.available = available;
		this.file_io = file_io;
	}

	/** Responsibilities: _current process identity_. **/
	public from_process(pid: number): ReviewAgentIdentityContract {
		if (process.platform !== "linux") {
			return new ReviewAgentIdentity(pid, "", "", false, this.file_io);
		}
		try {
			const stat = this.file_io.file_content.file_text(`/proc/${pid}/stat`);
			const command_end = stat.lastIndexOf(") ");
			if (command_end < 0) {
				return new ReviewAgentIdentity(pid, "", "", false, this.file_io);
			}
			const fields = stat.slice(command_end + 2).split(" ");
			const boot_id = this.file_io.file_content.file_text("/proc/sys/kernel/random/boot_id").trim();
			return this.process_fields(pid, fields, boot_id);
		} catch (error) {
			return new ReviewAgentIdentity(pid, "", "", false, this.file_io);
		}
	}

	/** Responsibilities: _identity record_. **/
	public stored_identity(text: string): ReviewAgentIdentityContract {
		const lines = text.split(/\r?\n/u);
		const pid = Number(lines.slice(0, 1).join(""));
		const start_time = lines.slice(1, 2).join("");
		const boot_id = lines.slice(2, 3).join("");
		const available = Number.isInteger(pid) && pid > 0 && start_time.length > 0 && boot_id.length > 0;
		return new ReviewAgentIdentity(pid, start_time, boot_id, available, this.file_io);
	}

	/** Responsibilities: _identity serialization_. **/
	public serialized(): string {
		if (!this.available) {
			return "";
		}
		return `${this.pid}\n${this.start_time}\n${this.boot_id}\n`;
	}

	/** Responsibilities: _identity comparison_. **/
	public matches(other: ReviewAgentIdentityContract): boolean {
		const other_serialized = other.serialized();
		if (!this.available) {
			return false;
		}
		if (other_serialized.length === 0) {
			return false;
		}
		return this.serialized() === other_serialized;
	}

	/** Responsibilities: _agent identity persistence_. **/
	public persist(root: string): void {
		const serialized_identity = this.serialized();
		if (serialized_identity.length === 0) {
			return;
		}
		const directory = resolve(
			root,
			AI_CODE_GUARD_DIRECTORY,
			REVIEW_DIRECTORY,
			REVIEW_RUN_LOCK_DIRECTORY,
			REVIEW_AGENT_DIRECTORY,
		);
		try {
			this.file_io.directory_operations.create_directory(directory);
			this.file_io.file_content.write_text(join(directory, String(this.pid)), serialized_identity);
		} catch (error) {
			return;
		}
	}
}
