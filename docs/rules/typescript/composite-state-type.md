# `composite-state-type`

Description: Do not combine named domain contracts with `|` or `&`. Keep simultaneous concepts in named fields; model exclusive runtime states with distinct classes. Literal and nullable unions are covered by other rules.

## Bad

```ts
// File: src/protocols.ts
export interface UserIdentityContract {
	normalized_id(): string;
	matches_id(candidate: string): boolean;
	prefix_matches(prefix: string): boolean;
}
export interface UserDetailsContract {
	display_name(): string;
	matches_name(candidate: string): boolean;
	initials(): string;
}
export type UserSummary = UserIdentityContract & UserDetailsContract;
// File: src/user_summary.ts
import type { UserSummary } from "./protocols";
export function emit_user_summary(summary: UserSummary): void {
	console.log(`${summary.normalized_id()}: ${summary.display_name()}`);
}
// File: cli.ts
import type { UserSummary } from "./src/protocols";
import { emit_user_summary } from "./src/user_summary";
const summary: UserSummary = {
	normalized_id: () => "u-1",
	display_name: () => "Ada",
};
emit_user_summary(summary);
```

## Good

Preserve each contract as a typed field and use concrete implementations:

```ts
// File: src/types.ts
export type UserIdentity = string;
export type UserDetails = string;
export type UserSummary = {
	identity: UserIdentity;
	details: UserDetails;
};
// File: src/user_summary_reporter.ts
export class UserSummaryReporter {
	private readonly _summaries: Map<string, string>;
	public constructor() {
		this._summaries = new Map<string, string>();
	}
	public record_summary(identity: string, details: string): void {
		this._summaries.set(identity, details);
	}
	public report(): void {
		for (const [identity, details] of this._summaries.entries()) {
			console.log(`${identity}: ${details}`);
		}
	}
	public item_count(): number {
		return this._summaries.size;
	}
	public clear(): void {
		this._summaries.clear();
	}
}
// File: cli.ts
import { UserSummaryReporter } from "src/user_summary_reporter";
import type { UserDetails, UserIdentity, UserSummary } from "src/types";
(function () {
	const identity: UserIdentity = "u-1";
	const details: UserDetails = "Ada";
	const summary: UserSummary = { identity, details };
	const reporter = new UserSummaryReporter();
	reporter.record_summary(summary.identity, summary.details);
	if (reporter.item_count() > 0) { reporter.report(); }
	reporter.clear();
})();
```
