# `type-operation`

Description: Type operations can hide a project contract behind a transformed type.

This includes utility types such as `Pick`, `Omit`, `Partial`, `Required`, `Readonly`,
`Record`, `Parameters`, and `ReturnType`; operators such as `keyof`, `typeof`, and
indexed access; and mapped, conditional, and intersection types. These forms make a
project contract depend implicitly on another type's structure. Declare the fields
and operations that the contract owns. Keep transformations at standard-library or
external API boundaries when they are the actual boundary contract.

## Bad

```ts
// File: src/types.ts
export interface UserContract {
	user_id: string;
	display_name: string;
	access_token: string;
}

export type VisibleUser = Pick<UserContract, "user_id" | "display_name">;
export type PublicUser = Omit<UserContract, "access_token">;
export type UserUpdate = Partial<UserContract>;
export type UserField = keyof UserContract;
export type UserName = UserContract["display_name"];
export type UserById = Record<UserContract["user_id"], UserContract>;

export type UserSummary<T> = T extends UserContract
	? { [Field in keyof T as Field extends "access_token" ? never : Field]: T[Field] }
	: never;
// File: src/user_reporter.ts
import type { VisibleUser } from "src/types";

export class UserReporter {
	private readonly user: VisibleUser;
	public constructor(user: VisibleUser) {
		this.user = user;
	}
	public normalized_name(): string {
		const parts = this.user.display_name.trim().split(/\s+/);
		return parts.join(" ");
	}
	public initials(): string {
		const parts = this.normalized_name().split(" ");
		return parts.map((part) => part.slice(0, 1)).join("").toUpperCase();
	}
	public profile_line(): string {
		return `${this.initials()} ${this.normalized_name()}`;
	}
	public account_label(): string {
		return `Account ${this.user.user_id.toUpperCase()}`;
	}
	public report(): void {
		console.log(`${this.profile_line()} | ${this.account_label()}`);
	}
}
// File: cli.ts
import type { VisibleUser } from "src/types";
import { UserReporter } from "src/user_reporter";
(function () {
	const user: VisibleUser = { user_id: "u-1", display_name: "Ada Lovelace" };
	const reporter = new UserReporter(user);
	reporter.report();
})();
```

## Good

```ts
// File: src/types.ts
export type PublicUser = {
	user_id: string;
	display_name: string;
};
// File: src/user_reporter.ts
import type { PublicUser } from "src/types";

export class UserReporter {
	private readonly _user: PublicUser;
	public constructor(user: PublicUser) {
		this._user = user;
	}
	public normalized_name(): string {
		const words = this._user.display_name.trim().split(/\s+/u);
		return words.join(" ");
	}
	public initials(): string {
		return this.normalized_name().split(" ").map((part) => part.slice(0, 1)).join("").toUpperCase();
	}
	public profile_line(): string {
		return `${this.initials()} ${this.normalized_name()}`;
	}
	public account_label(): string {
		return `Account ${this._user.user_id.toUpperCase()}`;
	}
	public report(): void {
		console.log(`${this.profile_line()} | ${this.account_label()}`);
	}
}
// File: cli.ts
import type { PublicUser } from "src/types";
import { UserReporter } from "src/user_reporter";
(function () {
	const user: PublicUser = { user_id: "u-1", display_name: "Ada Lovelace" };
	const reporter = new UserReporter(user);
	reporter.report();
})();
```

Use a distinct command or operation contract for supported updates instead of
making every field optional with `Partial<T>`. Declare named parameter and result
contracts instead of deriving them from `Parameters<typeof operation>` or
`ReturnType<typeof operation>`. Model finite keys explicitly instead of deriving
them with `keyof` or indexed access. Avoid intersections for combining project
contracts; give each concept a named field, as required by `composite-state-type`.
