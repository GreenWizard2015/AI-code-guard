# `top-level-classes`

Description: One primary top-level class gives a file a clear owner.

## Bad

```ts
class AccountRecord { public readonly account_id: string = "a"; }
class AddressRecord { public readonly postal_code: number = 1; }
class AuditRecord { public readonly event_name: boolean = true; }
class SessionRecord { public readonly expires_at: Date = new Date(); } // <- error
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

