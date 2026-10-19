# responsibilities-min-count

Description: Detect a class whose `Responsibilities:` line names fewer than two distinct areas of work. Interfaces, protocols, and field-only record classes may have one cohesive contract responsibility; functions and methods need one.

Expand a class contract when it owns another real area of work, or split it when the work does not belong together. A class containing only annotated fields is a record contract and needs one responsibility. Do not repeat vague words or add padding only to silence the rule.

## Bad

```ts
// File: src/account_session.ts
/** Responsibilities: _account state_. **/
export class AccountSession {
	private readonly account_id: string;
	public constructor(account_id: string) {
		this.account_id = account_id;
	}
	/** Responsibilities: _account lookup_. **/
	public account(): string {
		return this.account_id;
	}
	/** Responsibilities: _account label_. **/
	public label(): string {
		return `Account ${this.account_id}`;
	}
}
// File: cli.ts
import { AccountSession } from "src/account_session";
(function (): void {
	const account = new AccountSession("account-1");
	console.log(account.account(), account.label());
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
#!/usr/bin/env node
import { UserSessionContract } from "src/protocols";
/** Responsibilities: _account identity_, _session state_. **/
export class UserSession implements UserSessionContract {
	private readonly logger: Console;
	private readonly account_id: string;
	/** Responsibilities: _session initialization_. **/
	public constructor(logger: Console, account_id: string) { this.logger = logger; this.account_id = account_id; }
	/** Responsibilities: _account validation_. **/
	public refresh(): string { const account = this.account_id.trim(); if (account.length === 0) { return "invalid"; } this.logger.log(`refresh ${account}`); return "refreshed"; }
	/** Responsibilities: _session closure_. **/
	public close(): string { this.logger.log(`close ${this.account_id}`); return "closed"; }
	/** Responsibilities: _session status_. **/
	public status_label(): string { const account = this.account_id.trim(); if (account.length === 0) { return "unavailable"; } return `Account ${account}`; }
}
(function () { const session = new UserSession(console, "account-1"); console.log(session.refresh(), session.close(), session.status_label()); })();
```

