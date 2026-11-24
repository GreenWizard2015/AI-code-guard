import { join } from "node:path";
import type { ProcessSignalContract } from "src/analysis_protocols";
import { REVIEW_AGENT_DIRECTORY } from "src/core/support/task/review-agent/constants";
import type { ReviewAbandonedAgentCleanupContract } from "src/core/support/task/review-agent/protocols";
import type { ReviewAgentIdentityContract } from "src/core/support/task/review-agent/types";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type { FileEntry, IOContract } from "src/io/protocols";

/** Responsibilities: _abandoned review-agent discovery_, _stale process termination_. **/
export class ReviewAbandonedAgentCleanup implements ReviewAbandonedAgentCleanupContract {
	private readonly _file_io: IOContract;
	private readonly _process_signal: ProcessSignalContract;

	/** Responsibilities: _stale agent process termination_. **/
	private terminate_stale_process(
		pid: number,
		identity_reader: ReviewAgentIdentityContract,
		stored_identity: ReviewAgentIdentityContract,
	): boolean {
		const current = identity_reader.from_process({ value: pid });
		if (stored_identity.matches(current)) {
			return this._process_signal.terminate_group({ id: pid });
		}
		if (current.serialized().length === 0) {
			if (!this._process_signal.group_exists({ id: pid })) {
				return true;
			}
			const ownership = stored_identity.owned_process_group();
			if (ownership.token.length > 0) {
				return this._process_signal.terminate_owned_group(ownership);
			}
		}
		return !this._process_signal.group_exists({ id: pid });
	}

	/** Responsibilities: _recorded agent identity verification_. **/
	private terminate_recorded_agent(directory: string, entry: FileEntry, pid: number): boolean {
		const reader = new ReviewAgentIdentity({
			pid: 0,
			start_time: "",
			boot_id: "",
			available: false,
			file_io: this._file_io,
			ownership_token: "",
		});
		const stored = reader.stored_identity(this._file_io.file(join(directory, entry.name)).file_text());
		if (stored.serialized().length === 0) {
			return false;
		}
		return this.terminate_stale_process(pid, reader, stored);
	}

	/** Responsibilities: _abandoned agent entry termination_. **/
	private terminate_entry(directory: string, entry: FileEntry): boolean {
		if (!entry.is_file) {
			return true;
		}
		const pid = Number(entry.name);
		if (!Number.isInteger(pid) || pid <= 0) {
			return true;
		}
		if (pid === process.pid) {
			return true;
		}
		return this.terminate_recorded_agent(directory, entry, pid);
	}

	/** Responsibilities: _cleanup dependency initialization_. **/
	public constructor(file_io: IOContract, process_signal: ProcessSignalContract) {
		this._file_io = file_io;
		this._process_signal = process_signal;
	}

	/** Responsibilities: _abandoned agent entry discovery_. **/
	public entries(lock_path: string): readonly FileEntry[] {
		const directory = join(lock_path, REVIEW_AGENT_DIRECTORY);
		if (!this._file_io.file(directory).path_exists()) {
			return [];
		}
		return this._file_io.list_entries(directory);
	}

	/** Responsibilities: _abandoned review-agent cleanup_. **/
	public terminate(lock_path: string): boolean {
		const directory = join(lock_path, REVIEW_AGENT_DIRECTORY);
		for (const entry of this.entries(lock_path)) {
			if (!this.terminate_entry(directory, entry)) {
				return false;
			}
		}
		return true;
	}
}
