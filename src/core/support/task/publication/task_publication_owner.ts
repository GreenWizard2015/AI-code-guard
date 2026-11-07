import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type { TaskPublicationOwnerContract } from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _publication transaction ownership_, _owner process liveness_. **/
export class TaskPublicationOwner implements TaskPublicationOwnerContract {
	private readonly _pid: number;
	private readonly _transaction_path: string;
	private readonly _owner_token: string;
	private readonly _process_identity: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _owner process identity match_. **/
	private identity_matches_process(): boolean {
		if (this._process_identity.length === 0) {
			return true;
		}
		const identity_reader = new ReviewAgentIdentity({
			pid: 0,
			start_time: "",
			boot_id: "",
			available: false,
			file_io: this._file_io,
			ownership_token: "",
		});
		const stored = identity_reader.stored_identity(this._process_identity);
		const current = identity_reader.from_process({ value: this._pid });
		if (current.serialized().length === 0) {
			return true;
		}
		return stored.matches(current);
	}

	/** Responsibilities: _publication owner initialization_. **/
	public constructor(pid: number, transaction: string, token: string, process_identity: string, file_io: IOContract) {
		this._pid = pid;
		this._transaction_path = transaction;
		this._owner_token = token;
		this._process_identity = process_identity;
		this._file_io = file_io;
	}

	/** Responsibilities: _publication owner validation_. **/
	public valid(): boolean {
		if (!Number.isInteger(this._pid)) {
			return false;
		}
		return this._pid > 0;
	}

	/** Responsibilities: _publication owner liveness_. **/
	public live(): boolean {
		try {
			process.kill(this._pid, 0);
			return this.identity_matches_process();
		} catch (error) {
			const message = String(error);
			if (message.includes("EPERM")) {
				return true;
			}
			if (message.includes("ESRCH")) {
				return false;
			}
			throw error;
		}
	}

	/** Responsibilities: _abandoned transaction recovery identity_. **/
	public abandoned_transaction(): string {
		if (!this.valid()) {
			return "";
		}
		return this._transaction_path;
	}

	/** Responsibilities: _publication token ownership check_. **/
	public owns_token(token: string): boolean {
		return this._owner_token === token;
	}

	/** Responsibilities: _publication token identity_. **/
	public same_token(owner: TaskPublicationOwnerContract): boolean {
		return owner.owns_token(this._owner_token);
	}
}
