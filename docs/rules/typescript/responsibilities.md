# responsibilities

Description: Require every class, interface, type, method, and function to state its real ownership boundary in a docstring.

Use exactly one `Responsibilities:` line in each declaration's documentation. Put every responsibility on that line:

```text
Responsibilities: _parse input, normalize input_, _validate state_.
```

In TypeScript doc comments, close the documentation with `**/`, not `*/`.

Keep the list concise and comma-separated. Wrap every responsibility in paired `_` characters; commas inside a wrapped responsibility are allowed. Interface methods are excluded because the interface contract is the documented boundary.

Each phrase must name an explicit object and the work owned for it, using at least two words: `_source parsing_`, not `_parsing_`. Do not split one declaration's responsibilities across multiple lines.

Write responsibilities as short noun phrases naming the owned work, not as descriptions of a return value or a condition. For example, use `_user validation_`, not `_returns whether the user is valid_`.

Do not invent generic labels, hide multiple responsibilities in one phrase, or use the line only to silence the diagnostic. Split the owner when its responsibilities cannot be named honestly within the limit.

## Bad

```ts
// File: src/validator.ts
export class Validator {
	private readonly value: string;
	/** Responsibilities: _account handling_.
	 * Responsibilities: _session handling_. **/
	public constructor(value: string) {
		this.value = value;
	}
	/** Responsibilities: _validation_. **/
	public validation_label(): string {
		return `Validated ${this.value.trim()}`;
	}
	/** Responsibilities: _validation report output_. **/
	public report(): void {
		console.log(this.validation_label());
	}
}
// File: cli.ts
import { Validator } from "src/validator";
(function () {
	const validator = new Validator("ready");
	validator.report();
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
		return `closed ${this._account_id.trim().toLowerCase()}`;
	}
	/** Responsibilities: _session status_. **/
	public status_label(): string {
		const account = this._account_id.trim().toLowerCase();
		if (account.length === 0) { return "unavailable"; }
		return `Account ${account}`;
	}
	/** Responsibilities: _session report output_. **/
	public report(): void {
		console.log(`${this.refresh()} | ${this.close()} | ${this.status_label()}`);
	}
}
// File: cli.ts
import { UserSession } from "src/user_session";
(function () {
	const session = new UserSession("account-1");
	session.report();
})();
```

