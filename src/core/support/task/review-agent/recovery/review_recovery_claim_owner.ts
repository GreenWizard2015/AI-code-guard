import { join } from "node:path";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { ReviewAgentIdentityContract } from "src/core/support/task/review-agent/types";
import type {
	ReviewRecoveryClaimOwnerContract,
	ReviewRecoveryClaimOwnerOptions,
	ReviewRecoveryClaimPublication,
	ReviewRecoveryOwnerRecord,
	ReviewRecoveryOwnerRecordPublication,
	ReviewRecoveryProcessIdentity,
} from "src/core/support/task/review-agent/types";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";

/** Responsibilities: _recovery owner identity_, _owner record lifecycle_. **/
export class ReviewRecoveryClaimOwner implements ReviewRecoveryClaimOwnerContract {
	private readonly _options: ReviewRecoveryClaimOwnerOptions;

	/** Responsibilities: _recovery identity reader_. **/
	private identity_reader(): ReviewAgentIdentityContract {
		return new ReviewAgentIdentity({
			pid: 0,
			start_time: "",
			boot_id: "",
			available: false,
			file_io: this._options.file_io,
			ownership_token: "",
		});
	}

	/** Responsibilities: _recovery process liveness_. **/
	private process_record_live(owner_record: ReviewRecoveryOwnerRecord): boolean {
		const identity = owner_record.process_identity;
		if (!Number.isInteger(identity.process_id) || identity.process_id <= 0) {
			return false;
		}
		if (!this._options.process_signal.pid_exists({ value: identity.process_id })) {
			return false;
		}
		return this.process_incarnation_live(identity);
	}

	/** Responsibilities: _process incarnation comparison_. **/
	private process_incarnation_live(process_identity: ReviewRecoveryProcessIdentity): boolean {
		if (process_identity.start_time.length === 0) {
			return true;
		}
		if (process_identity.boot_id.length === 0) {
			return true;
		}
		const identity = this.identity_reader();
		const stored = identity.stored_identity(
			`${process_identity.process_id}\n${process_identity.start_time}\n${process_identity.boot_id}\n`,
		);
		const current = identity.from_process({ value: process_identity.process_id });
		if (current.serialized().length === 0) {
			return true;
		}
		return stored.matches(current);
	}

	/** Responsibilities: _staged owner record publication_. **/
	private write_owner_record(request: ReviewRecoveryOwnerRecordPublication): void {
		const serialized = this.identity_reader().from_process({ value: process.pid }).serialized();
		const fields = serialized.split("\n");
		const owner_text = `${process.pid}\n${request.ownership_token}\n${fields[1] ?? ""}\n${fields[2] ?? ""}\n`;
		this._options.file_io.file(join(request.staging_path, "owner")).write_text(owner_text);
	}

	/** Responsibilities: _recovery owner setup_. **/
	public constructor(options: ReviewRecoveryClaimOwnerOptions) {
		this._options = options;
	}

	/** Responsibilities: _recovery owner liveness_. **/
	public owner_live(owner_text: string): boolean {
		const fields = owner_text.split(/\r?\n/u);
		const owner_record: ReviewRecoveryOwnerRecord = {
			ownership_token: fields[1] ?? "",
			process_identity: {
				process_id: Number(fields[0] ?? ""),
				start_time: fields[2] ?? "",
				boot_id: fields[3] ?? "",
			},
		};
		try {
			return this.process_record_live(owner_record);
		} catch (error) {
			if (!this._options.failure_classification.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return this._options.failure_classification.check(String(error), BoundaryFailureCategory.Permission);
		}
	}

	/** Responsibilities: _recovery claim owner publication_. **/
	public publish(request: ReviewRecoveryClaimPublication): boolean {
		let created = false;
		try {
			this._options.file_io.create_directory_exclusive(request.staging_path);
			created = true;
			this.write_owner_record(request);
			this._options.file_io.move_path(request.staging_path, request.target_path);
			return true;
		} catch (error) {
			if (created) {
				this._options.file_io.remove_path(request.staging_path);
			}
			if (!this._options.failure_classification.check(String(error), BoundaryFailureCategory.System)) {
				throw error;
			}
			return false;
		}
	}
}
