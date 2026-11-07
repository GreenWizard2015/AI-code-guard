# `setter`

Description: Make state changes explicit. A TypeScript `set` accessor hides a state transition behind property assignment.

## Bad

```ts
// File: src/protocols.ts
export interface ProfileContract {
	display_name(): string;
}
// File: src/profile.ts
/** Responsibilities: _profile state transitions_. **/
import type { ProfileContract } from "src/protocols";
export class Profile implements ProfileContract {
	private current_name: string = "Ada";
	/** Responsibilities: _profile name assignment_. **/
	public set name(next_name: string) { this.current_name = next_name; } // <- error
	/** Responsibilities: _profile output_. **/
	public report(): void { console.log(this.current_name); }
}
// File: cli.ts
import { Profile } from "src/profile";
(function () {
	const profile = new Profile();
	profile.name = "Grace";
	profile.report();
})();
```

## Good

```ts
// File: src/profile.ts
/** Responsibilities: _profile state transitions_. **/
export class Profile {
	private readonly _current_name: string;
	public constructor(current_name: string) {
		this._current_name = current_name.trim();
	}
	/** Responsibilities: _profile name transition_. **/
	public change_name(next_name: string): ProfileContract { return new Profile(next_name.trim()); }
	public display_name(): string {
		if (this._current_name.length === 0) {
			return "Anonymous";
		}
		return this._current_name;
	}
	public name_length(): number { return this.display_name().length; }
	public display_label(): string {
		const name = this.display_name();
		return `Profile: ${name}`;
	}
	public uppercase_name(): string {
		return this.display_name().toUpperCase();
	}
	/** Responsibilities: _profile output_. **/
	public report(): void { console.log(`${this.display_label()} ${this.uppercase_name()} ${this.name_length()}`); }
}
// File: cli.ts
import { Profile } from "src/profile";
(function () {
	const profile = new Profile("Ada");
	const updated_profile: ProfileContract = profile.change_name("Grace");
	updated_profile.report();
})();
```
