# `attribute-depth`

Description: Deep object graphs couple callers to implementation details.

## Bad

```ts
// File: src/profile.ts
interface ProfileRequest {
	session: {
		user: {
			profile: {
				identifier: string;
				display_name: string;
				contact_address: string;
				active: boolean;
			};
		};
	};
}

export class Profile {
	private readonly request: ProfileRequest;
	public constructor(request: ProfileRequest) {
		this.request = request;
	}
	public user_id(): string {
		return this.request.session.user.profile.identifier;
	}
	public display_name(): string {
		return this.request.session.user.profile.display_name;
	}
	public contact_address(): string {
		return this.request.session.user.profile.contact_address;
	}
	public is_active(): boolean {
		return this.request.session.user.profile.active;
	}
	public report(): void {
		const summary = [
			this.user_id(),
			this.display_name(),
			this.contact_address(),
			String(this.is_active()),
		].join(" | ");
		console.log(summary);
	}
}
// File: cli.ts
import { Profile } from "src/profile";
(function () {
	const request = {
		session: {
			user: {
				profile: {
					identifier: "user-17",
					display_name: "Ada Lovelace",
					contact_address: "ada@example.test",
					active: true,
				},
			},
		},
	};
	const profile = new Profile(request);
	profile.report();
})();
```

**Fix:** Add a named operation or narrow boundary; do not hide the chain in temporary variables.

## Good

Consumers use a small identity boundary instead of traversing the request graph.

```ts
// File: src/user_identity.ts
import type { UserIdentityContract } from "src/protocols";

export class UserIdentity implements UserIdentityContract {
	private readonly _identifier: string;
	private readonly _name: string;
	private readonly _address: string;
	private readonly _active_state: boolean;
	public constructor(identifier: string, name: string, address: string, active_state: boolean) {
		this._identifier = identifier;
		this._name = name;
		this._address = address;
		this._active_state = active_state;
	}
	public user_id(): string {
		return this._identifier;
	}
	public display_name(): string {
		return this._name;
	}
	public contact_address(): string {
		return this._address;
	}
	public active(): boolean {
		return this._active_state;
	}
	public report(): void {
		const summary = [
			this.user_id(),
			this.display_name(),
			this.contact_address(),
			String(this.active()),
		].join(" | ");
		console.log(summary);
	}
}
// File: src/protocols.ts
export interface UserIdentityContract {
	user_id(): string;
	display_name(): string;
	contact_address(): string;
	active(): boolean;
}
// File: cli.ts
import { UserIdentity } from "src/user_identity";
(function () {
	const identity = new UserIdentity("user-17", "Ada Lovelace", "ada@example.test", true);
	identity.report();
})();
```
