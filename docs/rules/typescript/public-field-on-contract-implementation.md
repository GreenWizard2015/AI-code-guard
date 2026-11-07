# Public field on contract implementation

Description: Classes implementing an interface keep their state private and expose behavior through the contract.

## Bad

```ts
// File: src/protocols.ts
export interface StoreContract {
	read(): string;
}
// File: src/store.ts
import type { StoreContract } from "src/protocols";

export class Store implements StoreContract {
	public state: string;
	public constructor(state: string) {
		this.state = state;
	}
	public read(): string {
		return this.state.trim().toUpperCase();
	}
	public report(): void {
		const current_state = this.read();
		console.log(current_state);
	}
}
// File: cli.ts
import { Store } from "src/store";
(function () {
	const store = new Store("ready");
	store.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface StoreContract {
	status_label(): string;
	status_length(): number;
	ready(): boolean;
	prefix_matches(prefix: string): boolean;
}
// File: src/store.ts
import type { StoreContract } from "src/protocols";

export class Store implements StoreContract {
	private readonly _status: string;
	public constructor(status: string) {
		this._status = status;
	}
	public status_label(): string {
		const normalized = this._status.trim();
		if (normalized.length === 0) {
			return "unknown";
		}
		return normalized.toUpperCase();
	}
	public status_length(): number {
		let length = 0;
		for (const character of this._status) {
			if (character.trim().length > 0) {
				length += 1;
			}
		}
		return length;
	}
	public ready(): boolean {
		const normalized = this._status.trim().toLowerCase();
		return normalized === "ready";
	}
	public prefix_matches(prefix: string): boolean {
		const normalized_prefix = prefix.trim().toLowerCase();
		const normalized_status = this._status.trim().toLowerCase();
		if (normalized_prefix.length === 0) {
			return false;
		}
		return normalized_status.startsWith(normalized_prefix);
	}
	public report(): void {
		const label = this.status_label();
		const length = this.status_length();
		const ready = this.ready();
		const prefixed = this.prefix_matches("rea");
		console.log(`${label} | length=${length} | ready=${ready} | prefix=${prefixed}`);
	}
}
// File: cli.ts
import { Store } from "src/store";
(function () {
	const store = new Store("ready");
	store.report();
})();
```
