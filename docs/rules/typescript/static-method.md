# `static-method`

Description: Keep dependencies explicit instead of hiding them in class-level behavior.

```ts
class User {
  private readonly id: string;

  public constructor(id: string) {
    this.id = id;
  }

  public static create(id: string) {
    const normalized_id = id.trim();
    if (normalized_id.length === 0) {
      throw new Error('id is required');
    }
    return new User(normalized_id);
  }
}
```


Fix: Use `function create_user(id: string): User` or inject a factory.

## Bad

```ts
// File: src/user.ts
export class User {
	private readonly user_id: string;
	public constructor(user_id: string) {
		this.user_id = user_id;
	}
	public static create(user_id: string): User {
		return new User(user_id.trim());
	}
	public report(): void {
		console.log(`user: ${this.user_id}`);
	}
}
// File: src/cli.ts
import { User } from "src/user";

(() => {
	const user = User.create("account-1");
	user.report();
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
	report(): void;
}
// File: src/user_session.ts
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
	/** Responsibilities: _session report output_. **/
	public report(): void {
		const label = this.status_label();
		const refreshed = this.refresh();
		const closed = this.close();
		console.log(`${label}: ${refreshed}, ${closed}`);
	}
}
// File: src/cli.ts
import { UserSession } from "src/user_session";
(function () {
	const session = new UserSession("account-1");
	session.report();
})();
```
