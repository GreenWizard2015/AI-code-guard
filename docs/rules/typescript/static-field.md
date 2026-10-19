# `static-field`

Description: Keep class state owned by an explicit instance or by the module, instead of hiding shared state on a class.

```ts
class SessionStore {
  private static readonly sessions = new Map<string, Session>();
}
```


Fix: Move instance state to an explicitly owned object, or move an immutable constant to the module level.

```ts
class SessionStore {
  private readonly sessions = new Map<string, Session>();
}
```

Static methods are checked by `typescript-static-method`; this rule reports only static property declarations.

## Bad

```ts
// File: src/session_store.ts
class SessionStore {
	private static readonly sessions = new Map<string, string>();
}
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
