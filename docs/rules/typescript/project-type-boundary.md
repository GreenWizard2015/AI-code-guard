# `project-type-boundary`

Description: Public callable boundaries accept named contracts, not concrete classes.

## Bad

```ts
// File: src/user.ts
export class User {
	private readonly display_name: string;
	private readonly account_id: string;
	public constructor(display_name: string, account_id: string) {
		this.display_name = display_name;
		this.account_id = account_id;
	}
	public content_text(): string {
		return this.display_name;
	}
	public initials(): string {
		return this.display_name.slice(0, 1).toUpperCase();
	}
	public account_identifier(): string {
		return this.account_id;
	}
	public profile_text(): string {
		return `${this.initials()}: ${this.content_text()} (${this.account_identifier()})`;
	}
}
// File: src/user_store.ts
import { User } from "src/user";

export class UserStore {
	private readonly user: User;
	private readonly prefix: string;

	public constructor(user: User, prefix: string) {
		this.user = user;
		this.prefix = prefix;
	}

	public save(): User {
		console.log(this.format_saved_user());
		return this.user;
	}

	public format_saved_user(): string {
		return `${this.prefix}: saved ${this.user.profile_text()}`;
	}

	public content_length(): number {
		return this.user.content_text().trim().length;
	}

	public receipt_text(): string {
		return `${this.format_saved_user()} (${this.content_length()} characters)`;
	}
}
// File: cli.ts
import { User } from "src/user";
import { UserStore } from "src/user_store";

(function run(): void {
	const user = new User("Ada", "user-1");
	const store = new UserStore(user, "directory");
	store.receipt_text();
	store.save();
})();
```
## Good

```ts
// File: src/protocols.ts
export interface UserReaderContract {
	content_text(): string;
	profile_text(): string;
}
// File: src/user.ts
import type { UserReaderContract } from "src/protocols";

export class User implements UserReaderContract {
	private readonly _display_name: string;
	private readonly _account_id: string;
	public constructor(display_name: string, account_id: string) {
		this._display_name = display_name;
		this._account_id = account_id;
	}
	public content_text(): string {
		return this._display_name;
	}
	public initials(): string {
		return this._display_name.slice(0, 1).toUpperCase();
	}
	public account_identifier(): string {
		return this._account_id;
	}
	public profile_text(): string {
		return `${this.initials()}: ${this.content_text()} (${this.account_identifier()})`;
	}
}
// File: src/user_store.ts
import type { UserReaderContract } from "src/protocols";

export class UserStore {
	private readonly _user: UserReaderContract;
	private readonly _prefix: string;

	public constructor(user: UserReaderContract, prefix: string) {
		this._user = user;
		this._prefix = prefix;
	}

	public save(): UserReaderContract {
		console.log(this.format_saved_user());
		return this._user;
	}

	public format_saved_user(): string {
		return `${this._prefix}: saved ${this._user.profile_text()}`;
	}

	public content_length(): number {
		return this._user.content_text().trim().length;
	}

	public receipt_text(): string {
		return `${this.format_saved_user()} (${this.content_length()} characters)`;
	}
}
// File: cli.ts
import { User } from "src/user";
import { UserStore } from "src/user_store";

(function run(): void {
	const user = new User("Ada", "user-1");
	const store = new UserStore(user, "directory");
	store.receipt_text();
	store.save();
})();
```

