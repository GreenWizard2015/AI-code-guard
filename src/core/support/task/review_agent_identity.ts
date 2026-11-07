import { join, resolve } from "node:path";
import type { OwnedProcessGroup, ProcessId } from "src/analysis_protocols";
import {
	AI_CODE_GUARD_DIRECTORY,
	REVIEW_AGENT_DIRECTORY,
	REVIEW_DIRECTORY,
	REVIEW_RUN_LOCK_DIRECTORY,
} from "src/core/support/task/review-agent/constants";
import type {
	ReviewAgentProcessCleanupContract,
	ReviewAgentProcessExecution,
} from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentIdentityContract } from "src/core/support/task/review-agent/types";
import type { ReviewAgentIdentityOptions } from "src/core/support/task/review-agent/types";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _process identity_, _agent identity storage_. **/
export class ReviewAgentIdentity implements ReviewAgentIdentityContract, ReviewAgentProcessCleanupContract {
	private readonly _pid: number;
	private readonly _start_time: string;
	private readonly _boot_id: string;
	private readonly _available: boolean;
	private readonly _ownership_token: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _system failure code recognition_. **/
	private system_failure(message: string): boolean {
		const words = message.split(/[^A-Z0-9]+/u);
		for (const word of words) {
			if (SYSTEM_FAILURE_CODES.includes(word)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _process identity record parsing_. **/
	private identity_from_stat(candidate: ProcessId, stat: string): ReviewAgentIdentityContract {
		const command_end = stat.lastIndexOf(") ");
		if (command_end < 0) {
			return this.unavailable_identity(candidate);
		}
		const fields = stat.slice(command_end + 2).split(" ");
		const start_time = fields.slice(19, 20).join("");
		const boot_id = this._file_io.file("/proc/sys/kernel/random/boot_id").file_text().trim();
		const available = start_time.length > 0 && boot_id.length > 0;
		if (!available) {
			return this.unavailable_identity(candidate);
		}
		return new ReviewAgentIdentity({
			pid: candidate.value,
			start_time,
			boot_id,
			available: true,
			file_io: this._file_io,
			ownership_token: "",
		});
	}

	/** Responsibilities: _unavailable identity representation_. **/
	private unavailable_identity(missing_process: ProcessId): ReviewAgentIdentityContract {
		return new ReviewAgentIdentity({
			pid: missing_process.value,
			start_time: "",
			boot_id: "",
			available: false,
			file_io: this._file_io,
			ownership_token: "",
		});
	}

	/** Responsibilities: _agent identity file removal_. **/
	private remove_identity_file(execution: ReviewAgentProcessExecution): void {
		const identity_file = this._file_io.file(
			resolve(
				execution.root,
				AI_CODE_GUARD_DIRECTORY,
				REVIEW_DIRECTORY,
				REVIEW_RUN_LOCK_DIRECTORY,
				REVIEW_AGENT_DIRECTORY,
				String(execution.child.identifier()),
			),
		);
		if (identity_file.path_exists()) {
			identity_file.remove_file();
		}
	}

	/** Responsibilities: _agent identity directory path_. **/
	/** Responsibilities: _ownership token record_. **/
	private identity_record(serialized_identity: string, ownership_token: string): string {
		let token_record = "";
		if (ownership_token.length > 0) {
			token_record = `${ownership_token}\n`;
		}
		return `${serialized_identity}${token_record}`;
	}

	/** Responsibilities: _agent identity file publication_. **/
	private write_identity_file(root: string, record: string): void {
		const directory = resolve(
			root,
			AI_CODE_GUARD_DIRECTORY,
			REVIEW_DIRECTORY,
			REVIEW_RUN_LOCK_DIRECTORY,
			REVIEW_AGENT_DIRECTORY,
		);
		this._file_io.create_directory(directory);
		this._file_io.file(join(directory, String(this._pid))).write_text(record);
	}

	/** Responsibilities: _review-agent identity state_. **/
	public constructor(options: ReviewAgentIdentityOptions) {
		this._pid = options.pid;
		this._start_time = options.start_time;
		this._boot_id = options.boot_id;
		this._available = options.available;
		this._ownership_token = options.ownership_token;
		this._file_io = options.file_io;
	}

	/** Responsibilities: _current process identity_. **/
	public from_process(process_id: ProcessId): ReviewAgentIdentityContract {
		if (process.platform !== "linux") {
			return this.unavailable_identity(process_id);
		}
		try {
			const stat = this._file_io.file(`/proc/${process_id.value}/stat`).file_text();
			return this.identity_from_stat(process_id, stat);
		} catch (error) {
			if (!this.system_failure(String(error))) {
				throw error;
			}
			return this.unavailable_identity(process_id);
		}
	}

	/** Responsibilities: _identity record_. **/
	public stored_identity(text: string): ReviewAgentIdentityContract {
		const lines = text.split(/\r?\n/u);
		const pid = Number(lines.slice(0, 1).join(""));
		const start_time = lines.slice(1, 2).join("");
		const boot_id = lines.slice(2, 3).join("");
		const ownership_token = lines.slice(3, 4).join("");
		const available = Number.isInteger(pid) && pid > 0 && start_time.length > 0 && boot_id.length > 0;
		return new ReviewAgentIdentity({
			pid,
			start_time,
			boot_id,
			available,
			file_io: this._file_io,
			ownership_token,
		});
	}

	/** Responsibilities: _identity serialization_. **/
	public serialized(): string {
		if (!this._available) {
			return "";
		}
		return `${this._pid}\n${this._start_time}\n${this._boot_id}\n`;
	}

	/** Responsibilities: _process-group ownership token access_. **/
	public owned_process_group(): OwnedProcessGroup {
		return { id: this._pid, token: this._ownership_token };
	}

	/** Responsibilities: _identity comparison_. **/
	public matches(other: ReviewAgentIdentityContract): boolean {
		const other_serialized = other.serialized();
		if (!this._available) {
			return false;
		}
		if (other_serialized.length === 0) {
			return false;
		}
		return this.serialized() === other_serialized;
	}

	/** Responsibilities: _agent identity persistence_. **/
	public persist(root: string, ownership_token: string): string {
		const serialized_identity = this.serialized();
		if (serialized_identity.length === 0) {
			return "";
		}
		try {
			const record = this.identity_record(serialized_identity, ownership_token);
			this.write_identity_file(root, record);
		} catch (error) {
			if (!this.system_failure(String(error))) {
				throw error;
			}
			return String(error);
		}
		return "";
	}

	/** Responsibilities: _process identity removal_. **/
	public unregister_agent(execution: ReviewAgentProcessExecution): string {
		if (!execution.child.identified()) {
			return "";
		}
		try {
			this.remove_identity_file(execution);
			return "";
		} catch (error) {
			if (!this.system_failure(String(error))) {
				throw error;
			}
			return String(error);
		}
	}
}
