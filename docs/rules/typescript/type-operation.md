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
interface UserContract {
	user_id: string;
	display_name: string;
	access_token: string;
}

type VisibleUser = Pick<UserContract, "user_id" | "display_name">;
type PublicUser = Omit<UserContract, "access_token">;
type UserUpdate = Partial<UserContract>;
type UserField = keyof UserContract;
type UserName = UserContract["display_name"];
type UserById = Record<UserContract["user_id"], UserContract>;

type UserSummary<T> = T extends UserContract
	? { [Field in keyof T as Field extends "access_token" ? never : Field]: T[Field] }
	: never;
```

## Good

```ts
// File: src/types.ts
export type PublicUser = {
	user_id: string;
	display_name: string;
};
export type UserField = "user_id" | "display_name";
// File: cli.ts
import type { PublicUser, UserField } from "src/types";
(function () {
	const user: PublicUser = { user_id: "u-1", display_name: "Ada" };
	const field: UserField = "display_name";
	console.log(user[field]);
})();
```

Use a distinct command or operation contract for supported updates instead of
making every field optional with `Partial<T>`. Declare named parameter and result
contracts instead of deriving them from `Parameters<typeof operation>` or
`ReturnType<typeof operation>`. Model finite keys explicitly instead of deriving
them with `keyof` or indexed access. Avoid intersections for combining project
contracts; give each concept a named field, as required by `composite-state-type`.
