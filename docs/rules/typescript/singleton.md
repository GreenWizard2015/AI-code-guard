# `singleton`

Description: A module-level class instance or Python `ClassVar` creates hidden shared state.

```ts
export const CLIENT = new Client();
```


Fix: Construct dependencies at the composition root and inject them into consumers.


Move class-level mutable state to an explicitly owned instance. Use a module-level immutable
constant only for genuinely shared configuration.

## Bad

```ts
// File: src/session.ts
class UserSession {
	private readonly account_id: string = "account-1";

	public refresh(): string {
		return `refreshed ${this.account_id}`;
	}

	public close(): string {
		return `closed ${this.account_id}`;
	}

	public status_label(): string {
		return `Account ${this.account_id}`;
	}

	public report(): void {
		console.log(`${this.refresh()} | ${this.close()} | ${this.status_label()}`);
	}
}
export const SESSION = new UserSession(); // <- error
// File: cli.ts
import { SESSION } from "src/session";
(function () { SESSION.report(); })();
```


## Good

```ts
// File: src/user_session.ts
export class UserSession {
	private readonly _state_transitions: string[];
	private readonly _account_id: string;

	public constructor(account_id: string) {
		this._account_id = account_id;
		this._state_transitions = ["active"];
	}

	public refresh(): string {
		const account = this._account_id.trim().toLowerCase();
		if (account.length === 0) { return "invalid"; }
		this._state_transitions.push("active");
		return "refreshed";
	}

	public close(): string {
		this._state_transitions.push("closed");
		return `closed ${this._account_id.trim().toLowerCase()}`;
	}

	public status_label(): string {
		const account = this._account_id.trim().toLowerCase();
		if (account.length === 0) { return "unavailable"; }
		let current_state = "active";
		for (const transition of this._state_transitions) {
			current_state = transition;
		}
		if (current_state === "closed") { return `Closed account ${account}`; }
		return `Account ${account}`;
	}

	public report(): void {
		console.log(`${this.refresh()} | ${this.close()} | ${this.status_label()}`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { UserSession } from "src/user_session";
(function () { const session = new UserSession("account-1"); session.report(); })();
```

