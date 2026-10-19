import type { TaskPublicationOwnerContract } from "src/core/support/task/types";

/** Responsibilities: _publication transaction ownership_, _owner process liveness_. **/
export class TaskPublicationOwner implements TaskPublicationOwnerContract {
	private readonly pid: number;
	private readonly transaction_path: string;
	private readonly owner_token: string;

	/** Responsibilities: _publication owner initialization_. **/
	public constructor(pid: number, transaction: string, token = "") {
		this.pid = pid;
		this.transaction_path = transaction;
		this.owner_token = token;
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
			return true;
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
