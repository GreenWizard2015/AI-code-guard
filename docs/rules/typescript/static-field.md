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
export class SessionStore {
	private static readonly sessions = new Map<string, string>();
	private readonly account_id: string;

	public constructor(account_id: string, status: string) {
		this.account_id = account_id;
		SessionStore.sessions.set(account_id, status);
	}

	public status_label(): string {
		return SessionStore.sessions.get(this.account_id) ?? "unavailable";
	}

	public session_count(): number {
		return SessionStore.sessions.size;
	}

	public report(): void {
		const status = this.status_label();
		const count = this.session_count();
		console.log(`${this.account_id}: ${status} (${count})`);
	}
}
// File: cli.ts
import { SessionStore } from "src/session_store";

(() => {
	const store = new SessionStore("account-1", "ready");
	store.report();
})();
```

## Good

```ts
// File: src/session_store.ts
export class SessionStore {
	private readonly _account_id: string;
	private readonly _sessions: Map<string, string>;

	public constructor(account_id: string) {
		this._account_id = account_id.trim().toLowerCase();
		this._sessions = new Map<string, string>();
	}

	public store_session(status: string): void {
		const normalized_status = status.trim();
		const status_parts = normalized_status.split(/\s+/u);
		const stored_status = status_parts.join("-");
		this._sessions.set(this._account_id, stored_status);
	}

	public status_label(): string {
		const stored_status = this._sessions.get(this._account_id);
		if (stored_status === undefined) {
			return "unavailable";
		}
		const status_parts = stored_status.split("-");
		return status_parts.join(" ").toUpperCase();
	}

	public report(): void {
		const status = this.status_label();
		const account_label = this._account_id.toUpperCase();
		const status_length = status.length;
		const report_line = `${account_label}: ${status} (${status_length} characters)`;
		console.log(report_line);
	}
}
// File: cli.ts
import { SessionStore } from "src/session_store";

(() => {
	const account_id = "account-1";
	const initial_status = "ready for review";
	const store = new SessionStore(account_id);
	store.store_session(initial_status);
	store.report();
})();
```
