# `top-level-classes`

Description: One primary top-level class gives a file a clear owner.

## Bad

```ts
// File: src/records.ts
export class AccountRecord { public readonly account_id: string = "a"; }
export class AddressRecord { public readonly postal_code: number = 1; }
export class AuditRecord { public readonly event_name: boolean = true; }
export class SessionRecord {
	public readonly expires_at: Date = new Date(); // <- error
	public report(account_id: string, postal_code: number, event_name: boolean): void {
		console.log(account_id, postal_code, event_name, this.expires_at);
	}
}
// File: cli.ts
import { AccountRecord, AddressRecord, AuditRecord, SessionRecord } from "src/records";
(function () {
	const account = new AccountRecord();
	const address = new AddressRecord();
	const audit = new AuditRecord();
	const session = new SessionRecord();
	session.report(account.account_id, address.postal_code, audit.event_name);
})();
```


**Fix:** Move independent classes to focused files; keep one small exception hierarchy together when appropriate.

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
import type { UserSessionContract } from "src/protocols";
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
		return "closed";
	}
	/** Responsibilities: _session status_. **/
	public status_label(): string {
		const account = this._account_id.trim().toLowerCase();
		if (account.length === 0) { return "unavailable"; }
		return `Account ${account}`;
	}
	public report(): void {
		const refreshed = this.refresh();
		const closed = this.close();
		const label = this.status_label();
		console.log(`${refreshed} ${closed} ${label}`);
	}
}
// File: cli.ts
import { UserSession } from "src/user_session";
(function () {
	const session = new UserSession("account-1");
	session.report();
})();
```

