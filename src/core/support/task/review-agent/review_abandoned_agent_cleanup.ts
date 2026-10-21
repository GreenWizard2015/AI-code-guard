import { join } from "node:path";
import type { ProcessSignalContract } from "src/analysis_protocols";
import { REVIEW_AGENT_DIRECTORY } from "src/core/support/task/review-agent/constants";
import type { ReviewAgentIdentityContract } from "src/core/support/task/review-agent/types";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type { FileEntryContract, IOContract } from "src/io/protocols";
import type { ReviewAbandonedAgentCleanupContract } from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _abandoned review-agent discovery_, _stale process termination_. **/
export class ReviewAbandonedAgentCleanup implements ReviewAbandonedAgentCleanupContract {
	private readonly file_io: IOContract;
	private readonly process_signal: ProcessSignalContract;

	/** Responsibilities: _stale agent process termination_. **/
	private terminate_stale_process(
		pid: number,
		identity_reader: ReviewAgentIdentityContract,
		stored_identity: ReviewAgentIdentityContract,
	): void {
		const current = identity_reader.from_process(pid);
		if (stored_identity.matches(current)) {
			this.process_signal.terminate_group(pid);
		}
	}

	/** Responsibilities: _recorded agent identity verification_. **/
	private terminate_recorded_agent(directory: string, entry: FileEntryContract, pid: number): void {
		const reader = new ReviewAgentIdentity(0, "", "", false, this.file_io);
		const stored = reader.stored_identity(this.file_io.file_content.file_text(join(directory, entry.name)));
		if (stored.serialized().length === 0) {
			return;
		}
		this.terminate_stale_process(pid, reader, stored);
	}

	/** Responsibilities: _abandoned agent entry termination_. **/
	private terminate_entry(directory: string, entry: FileEntryContract): void {
		if (!entry.is_file) {
			return;
		}
		const pid = Number(entry.name);
		if (!Number.isInteger(pid) || pid <= 0) {
			return;
		}
		if (pid === process.pid) {
			return;
		}
		this.terminate_recorded_agent(directory, entry, pid);
	}

	/** Responsibilities: _cleanup dependency initialization_. **/
	public constructor(file_io: IOContract, process_signal: ProcessSignalContract) {
		this.file_io = file_io;
		this.process_signal = process_signal;
	}

	/** Responsibilities: _abandoned agent entry discovery_. **/
	public entries(lock_path: string): readonly FileEntryContract[] {
		const directory = join(lock_path, REVIEW_AGENT_DIRECTORY);
		if (!this.file_io.file_paths.path_exists(directory)) {
			return [];
		}
		return this.file_io.directory_entries.list_entries(directory);
	}

	/** Responsibilities: _abandoned review-agent cleanup_. **/
	public terminate(lock_path: string): void {
		const directory = join(lock_path, REVIEW_AGENT_DIRECTORY);
		for (const entry of this.entries(lock_path)) {
			this.terminate_entry(directory, entry);
		}
	}
}
