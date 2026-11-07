import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import type { ProcessLivenessContract, SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type { TaskPublicationOwnerContract } from "src/core/support/task/types";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import type { StaleClaimOwnerSnapshot } from "src/task_types";

/** Responsibilities: _recovery claim acquisition_, _stale claim reclamation_. **/
export class TaskPublicationRecoveryClaim {
	private readonly _lock_path: string;
	private readonly _claim_path: string;
	private readonly _owner_token: string;
	private readonly _file_io: IOContract;
	private readonly _process_liveness: ProcessLivenessContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;

	/** Responsibilities: _stale claim detection_. **/
	private identity_mismatch(pid: number, start_time: string, boot_id: string): boolean {
		if (start_time.length === 0 || boot_id.length === 0) {
			return false;
		}
		const identity_reader = new ReviewAgentIdentity({
			pid: 0,
			start_time: "",
			boot_id: "",
			available: false,
			file_io: this._file_io,
			ownership_token: "",
		});
		const stored_text = `${pid}\n${start_time}\n${boot_id}\n`;
		const stored = identity_reader.stored_identity(stored_text);
		const current = identity_reader.from_process({ value: pid });
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
		if (!this._process_liveness.pid_exists({ value: pid })) {
			return true;
		}
		return this.identity_mismatch(pid, start_time, boot_id);
	}

	/** Responsibilities: _stale claim detection_. **/
	private owner_snapshot(owner_path: string): StaleClaimOwnerSnapshot {
		const exists = this._file_io.path_is_file(owner_path);
		let text = "";
		if (exists) {
			text = this._file_io.file(owner_path).file_text();
		}
		return { owner_path, exists, text };
	}

	/** Responsibilities: _stale claim owner validation_. **/
	private validate_stale_owner(observed: StaleClaimOwnerSnapshot): void {
		if (!observed.exists) {
			throw new Error(`Task publication lock recovery is already in progress: ${this._lock_path}`);
		}
		if (!this.owner_record_stale(observed.text)) {
			throw new Error(`Task publication lock recovery is already in progress: ${this._lock_path}`);
		}
	}

	/** Responsibilities: _stale claim archive authorization_. **/
	private stale_archive_path(observed: StaleClaimOwnerSnapshot): string {
		this.validate_stale_owner(observed);
		if (!this._file_io.file(this._claim_path).path_exists()) {
			return "";
		}
		const current_owner = this.owner_snapshot(observed.owner_path);
		if (current_owner.exists !== observed.exists || current_owner.text !== observed.text) {
			throw new Error(`Task publication lock recovery is already in progress: ${this._lock_path}`);
		}
		// Keep the fence outside the lock directory, which successful recovery removes.
		const snapshot = `${observed.exists ? "present" : "missing"}\n${observed.text}`;
		const fingerprint = createHash("sha256").update(snapshot).digest("hex");
		return join(dirname(this._lock_path), `${basename(this._lock_path)}.recovery-stale.${fingerprint}`);
	}

	/** Responsibilities: _stale claim removal_. **/
	private remove_existing_claim(): void {
		if (!this._file_io.file(this._claim_path).path_exists()) {
			return;
		}
		const observed = this.owner_snapshot(join(this._claim_path, "owner"));
		const archive_path = this.stale_archive_path(observed);
		if (archive_path.length === 0) {
			return;
		}
		this.move_stale_claim(archive_path);
	}

	/** Responsibilities: _claim movement conflict_. **/
	private claim_move_conflicted(archive_path: string): boolean {
		const archive_exists = this._file_io.file(archive_path).path_exists();
		if (archive_exists) {
			return true;
		}
		const claim_exists = this._file_io.file(this._claim_path).path_exists();
		return !claim_exists;
	}

	/** Responsibilities: _stale claim movement_. **/
	private move_stale_claim(archive_path: string): void {
		try {
			this._file_io.move_path(this._claim_path, archive_path);
		} catch (error) {
			if (this.claim_move_conflicted(archive_path)) {
				throw new AggregateError([error], `Task publication lock recovery is already in progress: ${this._lock_path}`);
			}
			throw error;
		}
	}

	/** Responsibilities: _failed claim cleanup_. **/
	private cleanup_failed_claim(path: string, created: boolean): void {
		if (!created) {
			return;
		}
		try {
			this._file_io.remove_path(path);
		} catch (cleanup_error) {
			if (!this._boundary_failures.check(String(cleanup_error), BoundaryFailureCategory.System)) {
				throw cleanup_error;
			}
		}
	}

	/** Responsibilities: _recovery claim owner publication_. **/
	private write_claim_owner(staging_path: string): void {
		const identity_reader = new ReviewAgentIdentity({
			pid: 0,
			start_time: "",
			boot_id: "",
			available: false,
			file_io: this._file_io,
			ownership_token: "",
		});
		const process_identity = identity_reader.from_process({ value: process.pid }).serialized();
		const [, start_time = "", boot_id = ""] = process_identity.split("\n");
		const owner_path = join(staging_path, "owner");
		const owner_text = `${process.pid}\n${this._owner_token}\n${start_time}\n${boot_id}\n`;
		this._file_io.file(owner_path).write_text(owner_text);
	}

	/** Responsibilities: _recovery claim initialization_. **/
	public constructor(
		lock_path: string,
		claim_path: string,
		owner_token: string,
		file_io: IOContract,
		process_liveness: ProcessLivenessContract,
	) {
		this._lock_path = lock_path;
		this._claim_path = claim_path;
		this._owner_token = owner_token;
		this._file_io = file_io;
		this._process_liveness = process_liveness;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
	}

	/** Responsibilities: _owner identity comparison_. **/
	public same_owner(expected: TaskPublicationOwnerContract, actual: TaskPublicationOwnerContract): boolean {
		if (!expected.same_token(actual)) {
			return false;
		}
		return expected.abandoned_transaction() === actual.abandoned_transaction();
	}

	/** Responsibilities: _recovery claim initialization_. **/
	public claim(): void {
		this.remove_existing_claim();
		const staging_path = `${this._claim_path}.${process.pid}.${randomUUID()}.initializing`;
		let created = false;
		try {
			this._file_io.create_directory_exclusive(staging_path);
			created = true;
			this.write_claim_owner(staging_path);
			this._file_io.move_path(staging_path, this._claim_path);
		} catch (error) {
			this.cleanup_failed_claim(staging_path, created);
			if (!this._boundary_failures.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			throw new Error(`Task publication recovery claim failed: ${this._lock_path} (${String(error)})`);
		}
	}
}
