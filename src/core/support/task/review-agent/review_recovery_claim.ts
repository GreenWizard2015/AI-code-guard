import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { ProcessSignalContract, SystemFailureClassificationContract } from "src/analysis_protocols";
import type { ReviewRecoveryClaimContract } from "src/core/support/task/review-agent/protocols";
import { ReviewRecoveryClaimOwner } from "src/core/support/task/review-agent/review_recovery_claim_owner";
import type { ReviewRecoveryClaimOwnerContract } from "src/core/support/task/review-agent/types";
import type { IOContract } from "src/io/protocols";
import type { StaleClaimOwnerSnapshot } from "src/task_types";

/** Responsibilities: _exclusive recovery ownership_, _claim lifecycle_. **/
export class ReviewRecoveryClaim implements ReviewRecoveryClaimContract {
	private readonly _path: string;
	private readonly _token: string;
	private readonly _file_io: IOContract;
	private readonly _failure_classification: SystemFailureClassificationContract;
	private readonly _owner: ReviewRecoveryClaimOwnerContract;

	/** Responsibilities: _claim owner observation_. **/
	private owner_snapshot(owner_path: string): StaleClaimOwnerSnapshot {
		const exists = this._file_io.file(owner_path).path_exists();
		let text = "";
		if (exists) {
			text = this._file_io.file(owner_path).file_text();
		}
		return { owner_path, exists, text };
	}

	/** Responsibilities: _claim owner snapshot comparison_. **/
	private owner_snapshot_matches(observed: StaleClaimOwnerSnapshot): boolean {
		const owner_file = this._file_io.file(observed.owner_path);
		const owner_exists = owner_file.path_exists();
		if (owner_exists !== observed.exists) {
			return false;
		}
		if (!owner_exists) {
			return true;
		}
		return owner_file.file_text() === observed.text;
	}

	/** Responsibilities: _stale claim archival_. **/
	private archive_stale_claim(observed: StaleClaimOwnerSnapshot): boolean {
		if (!this._file_io.file(this._path).path_exists()) {
			return true;
		}
		if (!this.owner_snapshot_matches(observed)) {
			return false;
		}
		// Keep this fence outside both the recovery claim and the review lock directories.
		const snapshot = `${observed.exists ? "present" : "missing"}\n${observed.text}`;
		const fingerprint = createHash("sha256").update(snapshot).digest("hex");
		const archive_path = `${this._path}.stale.${fingerprint}`;
		return this.move_stale_claim(archive_path);
	}

	/** Responsibilities: _stale claim movement_. **/
	private move_stale_claim(archive_path: string): boolean {
		try {
			this._file_io.move_path(this._path, archive_path);
			return true;
		} catch (error) {
			if (this._file_io.file(archive_path).path_exists()) {
				return false;
			}
			if (!this._file_io.file(this._path).path_exists()) {
				return false;
			}
			throw error;
		}
	}

	/** Responsibilities: _stale claim reclamation_. **/
	private remove_stale_claim(): boolean {
		if (!this._file_io.file(this._path).path_exists()) {
			return true;
		}
		const observed = this.owner_snapshot(join(this._path, "owner"));
		if (!observed.exists) {
			return false;
		}
		if (this._owner.owner_live(observed.text)) {
			return false;
		}
		return this.archive_stale_claim(observed);
	}

	/** Responsibilities: _recovery claim setup_. **/
	public constructor(
		path: string,
		file_io: IOContract,
		process_signal: ProcessSignalContract,
		failure_classification: SystemFailureClassificationContract,
	) {
		this._path = path;
		this._file_io = file_io;
		this._failure_classification = failure_classification;
		this._token = randomUUID();
		this._owner = new ReviewRecoveryClaimOwner({ file_io, process_signal, failure_classification });
	}

	/** Responsibilities: _recovery owner liveness_. **/
	public owner_is_live(path: string): boolean {
		try {
			const owner_text = this._file_io.file(join(path, "owner")).file_text();
			return this._owner.owner_live(owner_text);
		} catch (error) {
			if (!this._failure_classification.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return this._failure_classification.check(String(error), BoundaryFailureCategory.Permission);
		}
	}

	/** Responsibilities: _stale recovery claim removal_. **/
	public claim(): boolean {
		if (!this.remove_stale_claim()) {
			return false;
		}
		const staging_path = `${this._path}.${process.pid}.${this._token}.initializing`;
		return this._owner.publish({
			staging_path,
			target_path: this._path,
			ownership_token: this._token,
		});
	}

	/** Responsibilities: _recovery claim owner validation_. **/
	public release(): void {
		if (!this._file_io.file(this._path).path_exists()) {
			return;
		}
		const owner_text = this._file_io.file(join(this._path, "owner")).file_text();
		const owner_lines = owner_text.split(/\r?\n/u);
		if (owner_lines[1] === this._token) {
			this._file_io.remove_path(this._path);
		}
	}
}
