# `object-assign`

Description: Bulk mutation hides which owned fields change.

```ts
Object.assign(this.state, update);
```


Fix: Assign owned fields explicitly or return a new state value.

## Bad

```ts
// File: src/types.ts
export type MemberProfileState = { display_name: string; department: string };
export type MemberProfileUpdate = { display_name?: string; department?: string };
// File: src/member_profile.ts
import type { MemberProfileState, MemberProfileUpdate } from "src/types";

/** Responsibilities: _member profile management_. **/
export class MemberProfile {
	private readonly state: MemberProfileState;
	/** Responsibilities: _profile initialization_. **/
	public constructor(state: MemberProfileState) {
		this.state = state;
	}
	/** Responsibilities: _profile update application_. **/
	public apply(update: MemberProfileUpdate): void {
		Object.assign(this.state, update); // <- error
	}
	/** Responsibilities: _profile summary formatting_. **/
	public summary(): string {
		return `${this.state.display_name} — ${this.state.department}`;
	}
	/** Responsibilities: _profile report output_. **/
	public report(): void {
		this.apply({ department: "Research" });
		console.log(this.summary());
	}
}
// File: cli.ts
import { MemberProfile } from "src/member_profile";

(() => {
	const profile = new MemberProfile({ display_name: "Ada", department: "Engineering" });
	profile.report();
})();
```

## Good

```ts
// File: src/types.ts
export type MemberProfileState = {
	display_name: string;
	department: string;
};
// File: src/member_profile.ts
import type { MemberProfileState } from "src/types";

/** Responsibilities: _member profile management_. **/
export class MemberProfile {
	private readonly _state: MemberProfileState;
	/** Responsibilities: _profile initialization_. **/
	public constructor(display_name: string, department: string) {
		this._state = {
			display_name: display_name.trim(),
			department: department.trim(),
		};
	}
	/** Responsibilities: _explicit profile update_. **/
	public apply(display_name: string, department: string): void {
		this._state.display_name = display_name.trim();
		this._state.department = department.trim();
	}
	/** Responsibilities: _profile summary formatting_. **/
	public summary(): string {
		return `${this._state.display_name} — ${this._state.department}`;
	}
	/** Responsibilities: _profile report output_. **/
	public report(): void {
		this.apply("Ada Lovelace", "Research");
		console.log(this.summary());
	}
}
// File: cli.ts
import { MemberProfile } from "src/member_profile";

(() => {
	const profile = new MemberProfile("Ada", "Engineering");
	profile.report();
})();
```
