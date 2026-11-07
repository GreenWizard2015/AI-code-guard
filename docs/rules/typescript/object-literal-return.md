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
export interface UserViewContract {
	name(): string;
}
// File: src/user_directory.ts
import type { UserViewContract } from "src/protocols";

/** Responsibilities: _user directory lookup_. **/
export class UserDirectory {
	private readonly stored_name: string;
	/** Responsibilities: _directory initialization_. **/
	public constructor(user_name: string) {
		this.stored_name = user_name;
	}
	/** Responsibilities: _view creation_. **/
	public create_view(): UserViewContract {
		const user_name = this.stored_name;
		return { name: () => user_name }; // <- error
	}
	/** Responsibilities: _user name lookup_. **/
	public display_name(): string {
		const view = this.create_view();
		return view.name();
	}
	/** Responsibilities: _user report output_. **/
	public report(): void {
		console.log(`User: ${this.display_name()}`);
	}
}
// File: cli.ts
import { UserDirectory } from "src/user_directory";

(() => {
	const directory = new UserDirectory("Ada");
	directory.report();
})();
```

## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _user view behavior contract_. **/
export interface UserViewContract {
	display_label(): string;
}
// File: src/named_user.ts
import type { UserViewContract } from "src/protocols";

/** Responsibilities: _named user identity_. **/
export class NamedUser implements UserViewContract {
	private readonly _user_name: string;
	/** Responsibilities: _user initialization_. **/
	public constructor(user_name: string) {
		this._user_name = user_name;
	}
	/** Responsibilities: _user label creation_. **/
	public display_label(): string {
		const normalized_name = this._user_name.trim().replace(/\s+/gu, " ");
		return `User: ${normalized_name}`;
	}
	/** Responsibilities: _user initials_. **/
	public initials(): string {
		const normalized_name = this._user_name.trim().replace(/\s+/gu, " ");
		const name_parts = normalized_name.split(/\s+/u);
		const initials = name_parts.map((part) => part.slice(0, 1).toUpperCase());
		return initials.join("");
	}
	/** Responsibilities: _user name length_. **/
	public name_length(): number {
		return this._user_name.trim().length;
	}
	/** Responsibilities: _user report output_. **/
	public report(): void {
		console.log(`${this.display_label()} (${this.initials()}, ${this.name_length()})`);
	}
}
// File: cli.ts
import { NamedUser } from "src/named_user";

(() => {
	const user = new NamedUser("Ada");
	user.report();
})();
```
