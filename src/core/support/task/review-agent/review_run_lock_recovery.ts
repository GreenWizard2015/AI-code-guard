import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import type { ProcessSignalContract, SystemFailureClassificationContract } from "src/analysis_protocols";
import { REVIEW_AGENT_DIRECTORY } from "src/core/support/task/review-agent/constants";
import type { ReviewAgentIdentityContract } from "src/core/support/task/review-agent/types";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type { FileEntryContract, IOContract } from "src/io/protocols";

/** Responsibilities: _stale review lock recovery_, _abandoned agent cleanup_. **/
export class ReviewRunLockRecovery {
	private readonly path: string;
	private readonly recovery_path: string;
	private readonly file_io: IOContract;
	private readonly process_signal: ProcessSignalContract;
	/** Responsibilities: _abandoned lock directory discovery_. **/
	private stale_lock_paths(): string[] {
		const parent = dirname(this.path);
		const prefix = `${basename(this.path)}.stale.`;
		return this.file_io.directory_entries
			.list_entries(parent)
			.filter((entry) => entry.is_directory && entry.name.startsWith(prefix))
			.map((entry) => join(parent, entry.name))
			.sort();
	}

	/** Responsibilities: _owner process liveness_. **/
	private owner_is_live(lock_path: string, failure_classification: SystemFailureClassificationContract): boolean {
		try {
			const owner_text = this.file_io.file_content.file_text(join(lock_path, "owner"));
			const owner_lines = owner_text.split(/\r?\n/u);
			const pid_text = owner_lines[0];
			const pid = Number(pid_text);
			if (Number.isInteger(pid) === false || pid <= 0) {
				return false;
			}
			return this.process_signal.pid_exists(pid);
		} catch (error) {
			if (!failure_classification.system_failure_message(String(error))) {
				throw error;
			}
			return failure_classification.permission_denied(String(error));
		}
	}

	/** Responsibilities: _stale recovery claim_. **/
	private claim_recovery(failure_classification: SystemFailureClassificationContract): boolean {
		if (this.file_io.file_paths.path_exists(this.recovery_path)) {
			if (this.owner_is_live(this.recovery_path, failure_classification)) {
				return false;
			}
			this.file_io.directory_operations.remove_path(this.recovery_path);
		}
		try {
			this.file_io.directory_operations.create_directory_exclusive(this.recovery_path);
			this.file_io.file_content.write_text(join(this.recovery_path, "owner"), `${process.pid}\n`);
			return true;
		} catch (error) {
			if (!failure_classification.system_failure_message(String(error))) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _live lock restoration_. **/
	private restore_live_lock(stale_path: string, failure_classification: SystemFailureClassificationContract): boolean {
		try {
			this.file_io.directory_operations.move_path(stale_path, this.path);
			return false;
		} catch (error) {
			if (!failure_classification.system_failure_message(String(error))) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _stale agent process termination_. **/
	private terminate_stale_process(
		pid: number,
		identity_reader: ReviewAgentIdentityContract,
		stored_identity: ReviewAgentIdentityContract,
	): void {
		const current = identity_reader.from_process(pid);
		if (stored_identity.matches(current)) {
			this.process_signal.terminate_group(pid);
			return;
		}
		if (current.serialized().length > 0) {
			return;
		}
		if (!this.process_signal.group_exists(pid)) {
			return;
		}
		this.process_signal.terminate_group(pid);
	}

	/** Responsibilities: _abandoned agent entry termination_. **/
	private terminate_entry(directory: string, entry: FileEntryContract): void {
		if (!entry.is_file) {
			return;
		}
		const pid = Number(entry.name);
		if (!Number.isInteger(pid)) {
			return;
		}
		if (pid <= 0 || pid === process.pid) {
			return;
		}
		this.terminate_recorded_agent(directory, entry, pid);
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

	/** Responsibilities: _abandoned review-agent termination_. **/
	private terminate_abandoned_agents(lock_path: string): void {
		const directory = join(lock_path, REVIEW_AGENT_DIRECTORY);
		if (!this.file_io.file_paths.path_exists(directory)) {
			return;
		}
		for (const entry of this.file_io.directory_entries.list_entries(directory)) {
			this.terminate_entry(directory, entry);
		}
	}

	/** Responsibilities: _stale lock finalization_. **/
	private finalize_stale_lock(
		stale_path: string,
		failure_classification: SystemFailureClassificationContract,
	): boolean {
		if (this.owner_is_live(stale_path, failure_classification)) {
			return this.restore_live_lock(stale_path, failure_classification);
		}
		this.terminate_abandoned_agents(stale_path);
		this.file_io.directory_operations.remove_path(stale_path);
		return true;
	}

	/** Responsibilities: _stale lock path replacement_. **/
	private recover_stale_path(failure_classification: SystemFailureClassificationContract): boolean {
		if (!this.recover_stale_paths(failure_classification)) {
			return false;
		}
		if (!this.file_io.file_paths.path_exists(this.path)) {
			return true;
		}
		if (this.owner_is_live(this.path, failure_classification)) {
			return false;
		}
		const stale_path = `${this.path}.stale.${process.pid}.${randomUUID()}`;
		if (!this.stale_lock_path(stale_path, failure_classification)) {
			return false;
		}
		return this.finalize_stale_lock(stale_path, failure_classification);
	}

	/** Responsibilities: _active lock archival_. **/
	private stale_lock_path(stale_path: string, failure_classification: SystemFailureClassificationContract): boolean {
		try {
			this.file_io.directory_operations.move_path(this.path, stale_path);
			return true;
		} catch (error) {
			if (!failure_classification.system_failure_message(String(error))) {
				throw error;
			}
			return false;
		}
	}

	/** Responsibilities: _stale lock directory reconciliation_. **/
	private recover_stale_paths(failure_classification: SystemFailureClassificationContract): boolean {
		for (const stale_path of this.stale_lock_paths()) {
			if (!this.finalize_stale_lock(stale_path, failure_classification)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _review lock recovery setup_. **/
	public constructor(path: string, recovery_path: string, file_io: IOContract, process_signal: ProcessSignalContract) {
		this.path = path;
		this.recovery_path = recovery_path;
		this.file_io = file_io;
		this.process_signal = process_signal;
	}

	/** Responsibilities: _recovery owner liveness_. **/
	public recovery_is_live(failure_classification: SystemFailureClassificationContract): boolean {
		return this.owner_is_live(this.recovery_path, failure_classification);
	}

	/** Responsibilities: _pending recovery detection_. **/
	public recovery_required(): boolean {
		if (this.file_io.file_paths.path_exists(this.recovery_path)) {
			return true;
		}
		return this.stale_lock_paths().length > 0;
	}

	/** Responsibilities: _stale lock takeover_. **/
	public recover_stale_lock(failure_classification: SystemFailureClassificationContract): boolean {
		if (!this.claim_recovery(failure_classification)) {
			return false;
		}
		try {
			return this.recover_stale_path(failure_classification);
		} finally {
			this.file_io.directory_operations.remove_path(this.recovery_path);
		}
	}
}
