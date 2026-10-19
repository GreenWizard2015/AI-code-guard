# responsibilities

Description: Require every class, interface, type, method, and function to state its real ownership boundary in a docstring.

Use one line in the declaration documentation:

```text
Responsibilities: _parse input, normalize input_, _validate state_.
```

In TypeScript doc comments, close the documentation with `**/`, not `*/`.

Keep the list concise and comma-separated. Wrap every responsibility in paired `_` characters; commas inside a wrapped responsibility are allowed. Interface methods are excluded because the interface contract is the documented boundary.

Write responsibilities as short noun phrases naming the owned work, not as descriptions of a return value or a condition. For example, use `_user validation_`, not `_returns whether the user is valid_`.

Do not invent generic labels, hide multiple responsibilities in one phrase, or use the line only to silence the diagnostic. Split the owner when its responsibilities cannot be named honestly within the limit.

## Bad

```ts
class Validator {} // <- error
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

