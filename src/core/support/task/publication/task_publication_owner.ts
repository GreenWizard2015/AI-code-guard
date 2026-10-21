import type { TaskPublicationOwnerContract } from "src/core/support/task/types";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _publication transaction ownership_, _owner process liveness_. **/
export class TaskPublicationOwner implements TaskPublicationOwnerContract {
	private readonly pid: number;
	private readonly transaction_path: string;
	private readonly owner_token: string;
	private readonly process_identity: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _owner process identity match_. **/
	private identity_matches_process(): boolean {
		if (this.process_identity.length === 0) {
			return true;
		}
		const identity_reader = new ReviewAgentIdentity(0, "", "", false, this.file_io);
		const stored = identity_reader.stored_identity(this.process_identity);
		const current = identity_reader.from_process(this.pid);
		if (current.serialized().length === 0) {
			return true;
		}
		return stored.matches(current);
	}

	/** Responsibilities: _publication owner initialization_. **/
	public constructor(pid: number, transaction: string, token: string, process_identity: string, file_io: IOContract) {
		this.pid = pid;
		this.transaction_path = transaction;
		this.owner_token = token;
		this.process_identity = process_identity;
		this.file_io = file_io;
	}

	/** Responsibilities: _publication owner validation_. **/
	public valid(): boolean {
		if (!Number.isInteger(this.pid)) {
			return false;
		}
		return this.pid > 0;
	}

	/** Responsibilities: _publication owner liveness_. **/
	public live(): boolean {
		try {
			process.kill(this.pid, 0);
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
		return this.transaction_path;
	}

	/** Responsibilities: _publication token ownership check_. **/
	public owns_token(token: string): boolean {
		return this.owner_token === token;
	}

	/** Responsibilities: _publication token identity_. **/
	public same_token(owner: TaskPublicationOwnerContract): boolean {
		return owner.owns_token(this.owner_token);
	}
}
