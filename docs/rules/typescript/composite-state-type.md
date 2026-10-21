# `composite-state-type`

Description: Do not combine named domain contracts with `|` or `&`. Keep simultaneous concepts in named fields; model exclusive runtime states with distinct classes. Literal and nullable unions are covered by other rules.

## Bad

```ts
interface UserIdentityContract { readonly id: string; }
interface UserDetailsContract { readonly name: string; }
type UserSummary = UserIdentityContract & UserDetailsContract; // <- error
```

## Good

Preserve each contract as a typed field and use concrete implementations:

```ts
// File: src/protocols.ts
export interface UserIdentityContract {
	normalized_id(): string;
	matches_id(candidate: string): boolean;
}
export interface UserDetailsContract {
	display_name(): string;
	matches_name(candidate: string): boolean;
}
// File: src/user_identity.ts
import type { UserIdentityContract } from "src/protocols";
export class UserIdentity implements UserIdentityContract {
	private readonly id: string;
	public constructor(id: string) { this.id = id; }
	public normalized_id(): string { return this.id.trim().toLowerCase(); }
	public matches_id(candidate: string): boolean {
		return this.normalized_id() === candidate.trim().toLowerCase();
	}
}
// File: src/user_details.ts
import type { UserDetailsContract } from "src/protocols";
export class UserDetails implements UserDetailsContract {
	private readonly name: string;
	public constructor(name: string) { this.name = name; }
	public display_name(): string {
		const words = this.name.trim().split(/\s+/u);
		return words.join(" ");
	}
	public matches_name(candidate: string): boolean {
		const own_name = this.name.trim().toLowerCase();
		const candidate_name = candidate.trim().toLowerCase();
		return own_name === candidate_name;
	}
}
// File: src/user_summary.ts
import type { UserDetailsContract, UserIdentityContract } from "src/protocols";
export class UserSummary {
	private readonly identity: UserIdentityContract;
	private readonly details: UserDetailsContract;
	public constructor(
		identity: UserIdentityContract,
		details: UserDetailsContract,
	) {
		this.identity = identity;
		this.details = details;
	}
	public label(): string {
		return `${this.identity.normalized_id()}: ${this.details.display_name()}`;
	}
	public matches(user_id: string, name: string): boolean {
		const id_matches = this.identity.matches_id(user_id);
		const name_matches = this.details.matches_name(name);
		if (!id_matches) { return false; }
		return name_matches;
	}
	public same_identity(other: UserIdentityContract): boolean {
		return this.identity.normalized_id() === other.normalized_id();
	}
	public same_name(other: UserDetailsContract): boolean {
		return this.details.display_name() === other.display_name();
	}
}
// File: cli.ts
import { UserDetails } from "src/user_details";
import { UserIdentity } from "src/user_identity";
import { UserSummary } from "src/user_summary";
(function () {
	const identity = new UserIdentity("u-1");
	const details = new UserDetails("Ada");
	const summary = new UserSummary(identity, details);
	const label = summary.label();
	const matches = summary.matches("u-1", "Ada");
	const same_identity = summary.same_identity(identity);
	const same_name = summary.same_name(details);
	console.log(label, matches, same_identity, same_name);
})();
```
