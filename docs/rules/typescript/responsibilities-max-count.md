# responsibilities-max-count

Description: Detect an owner whose `Responsibilities:` line hides a boundary that is too broad for one contract.

Split the owner or method into focused boundaries and keep each child responsibility under the correct parent. Do not merge unrelated work into a vague label or remove meaningful responsibilities to silence the rule.

## Bad

```ts
// File: src/account_session.ts
/** Responsibilities: _account identity_, _session state_. **/
export class AccountSession { // <- error
	/** Responsibilities: _account validation_, _session renewal_, _failure notification_. **/
	public refresh(account_id: string): string { return account_id.trim(); }
	/** Responsibilities: _session report output_. **/
	public report(): void {
		console.log(this.refresh("account-1"));
	}
}
// File: cli.ts
import { AccountSession } from "src/account_session";

(() => {
	const session = new AccountSession();
	session.report();
})();
```


## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _session contract_, _lifecycle boundary_. **/
export interface UserSessionContract {
	refresh(): string;
	close(): string;
	status_label(): string;
}
// File: src/user_session.ts
import { UserSessionContract } from "src/protocols";
/** Responsibilities: _account identity_, _session state_. **/
export class UserSession implements UserSessionContract {
	private readonly _account_id: string;
	/** Responsibilities: _session initialization_. **/
	public constructor(account_id: string) {
		this._account_id = account_id;
	}
	/** Responsibilities: _account validation_. **/
	public refresh(): string {
		const account = this._account_id.trim().toLowerCase();
		if (account.length === 0) { return "invalid"; }
		return "refreshed";
	}
	/** Responsibilities: _session closure_. **/
	public close(): string {
		const normalized_account = this._account_id.trim().toLowerCase();
		const account_label = `Account ${normalized_account}`;
		const closure_label = `closed ${normalized_account}`;
		return `${account_label} | ${closure_label}`;
	}
	/** Responsibilities: _session status_. **/
	public status_label(): string {
		const normalized_account = this._account_id.trim().toLowerCase();
		if (normalized_account.length === 0) { return "unavailable"; }
		return `Account ${normalized_account}`;
	}
	/** Responsibilities: _session report output_. **/
	public report(): void {
		const refresh_result = this.refresh();
		const closure_result = this.close();
		const current_status = this.status_label();
		const session_state = [refresh_result, closure_result, current_status];
		const report_line = session_state.join(" | ");
		console.log(report_line);
	}
}
// File: cli.ts
import { UserSession } from "src/user_session";

(() => {
	const session = new UserSession("account-1");
	session.report();
})();
```

