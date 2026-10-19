# `object-literal-return`

Description: A class or behavioral interface return contract must be implemented
by a real class, not by an object literal with callable fields.

**Preferred fix order:**

1. Move invariants and owned data into an immutable value class.
2. Put wire-format conversion behind a dedicated serializer or payload class.
3. Return the class from the behavioral contract and serialize only at the
   boundary.
4. Keep a plain object when the returned contract is data-only and the object
   has no callable fields.

**Avoid:** empty wrappers, forwarding-only classes, and aliases introduced
only to silence the diagnostic.

Data-only object literals are allowed even when their return annotation names a
structural interface or class. The rule is about callable fields: a serializer
or factory may construct a wire payload directly, while an object literal that
implements behavior must be replaced with a real class.

```ts
interface UserView {
  name(): string;
}

class NamedUser implements UserView {
  private readonly user_name: string;

  public constructor(user_name: string) {
    this.user_name = user_name;
  }

  public name(): string {
    return this.user_name;
  }
}

function create_user(): UserView {
  return new NamedUser('Ada');
}
```

## Bad

```ts
// File: src/protocols.ts
export interface UserViewContract { name(): string; }
// File: functions.ts
export function create_user(): UserViewContract {
	return { name: () => "Ada" };
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
