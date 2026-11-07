# `reexports`

Description: Re-exporting imported symbols obscures the defining module.

Before:

```ts
// feature.ts
export { Client } from 'src/client';
export type { ClientOptions } from 'src/client';
```

```ts
// caller.ts
import { Client } from 'src/feature';
```

After:

```ts
// caller.ts
import { Client } from 'src/client';
```


Fix: Import `Client` from its defining module at the use site. Update all callers before removing a facade, and keep an entry-point export only when it is part of the intentional external API.

Registry example:

```ts
// Before: types.ts owns unrelated types and re-exports the registry.
export { ToolRegistry } from 'src/registry';
```

```ts
// After: callers use the defining owner.
import { ToolRegistry } from 'src/registry';
```

Do not preserve an internal compatibility alias just to avoid updating callers.
The rule also rejects type-only re-exports; import the type from its defining module instead.


## Bad

```ts
// File: src/client.ts
export class Client {
	private readonly client_id: string;

	public constructor(client_id: string) {
		this.client_id = client_id;
	}

	public connection_label(): string {
		return `Connected ${this.client_id}`;
	}

	public status_label(): string {
		return `Client ${this.client_id} is ready`;
	}

	public report(): void {
		console.log(`${this.connection_label()} | ${this.status_label()}`);
	}
}
// File: src/feature.ts
export { Client } from "src/client"; // <- error
// File: cli.ts
import { Client } from "src/feature";
(function () {
	const client = new Client("primary");
	client.report();
})();
```


## Good

```ts
// File: src/account_profile.ts
export class AccountProfile {
	private readonly _access_history: string[];
	private readonly _given_name: string;
	private readonly _family_name: string;
	private readonly _access_level: string;

	public constructor(given_name: string, family_name: string, access_level: string) {
		this._given_name = given_name;
		this._family_name = family_name;
		this._access_level = access_level;
		this._access_history = [access_level];
	}

	public full_name(): string {
		return `${this._given_name} ${this._family_name}`;
	}

	public change_access_level(next_level: string): void {
		this._access_history.push(next_level);
	}

	public access_label(): string {
		let current_level = this._access_level;
		for (const level of this._access_history) {
			current_level = level;
		}
		return `Access: ${current_level.toUpperCase()}`;
	}

	public summary(): string {
		const full_name = this.full_name().trim();
		const normalized_name = full_name.toLowerCase();
		const current_access = this.access_label();
		const access_change_count = this._access_history.length;
		const display = `${full_name} (${current_access})`;
		return `${display} [${normalized_name}; ${access_change_count} access levels]`;
	}

	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { AccountProfile } from "src/account_profile";
(function () {
	const profile = new AccountProfile("Ada", "Lovelace", "viewer");
	profile.change_access_level("editor");
	profile.report();
})();
```

