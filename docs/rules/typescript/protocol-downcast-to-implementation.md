# Protocol downcast to implementation

Description: A value typed as a project interface is narrowed to a project implementation so code can call a member absent from the interface. Keep the behavior in the contract or validate external input at its boundary.

## Bad

```ts
// File: src/loader/loader.ts
interface StoreContract { entry(key: string): string; }
export class SqlStore implements StoreContract {
	public entry(key: string): string { return key; }
	public sql_transaction(): void {}
}

export class Loader {
	public entry(store: StoreContract, key: string): string {
		if (store instanceof SqlStore) { store.sql_transaction(); } // <- error
		return store.entry(key);
	}
	public report(store: StoreContract): void {
		const result = this.entry(store, "primary");
		console.log(`Loaded ${result}`);
	}
}
// File: cli.ts
import { Loader, SqlStore } from "src/loader/loader";
(function () {
	const loader = new Loader();
	const store = new SqlStore();
	loader.report(store);
})();
```

## Good

```ts
// File: src/protocols.ts
export interface StoreContract {
	retrieve(key: string): string;
	transaction(): void;
	record_count(): number;
}
// File: src/store/sql_store.ts
import type { StoreContract } from "src/protocols";
export class SqlStore implements StoreContract {
	private readonly _records: Map<string, string>;
	public constructor(records: Map<string, string>) { this._records = records; }
	public retrieve(key: string): string {
		const value = this._records.get(key.trim());
		if (value === undefined) { return "missing"; }
		return value;
	}
	public transaction(): void {
		for (const key of this._records.keys()) { if (key.length === 0) { this._records.delete(key); } }
	}
	public record_count(): number {
		let count = 0;
		for (const value of this._records.values()) { if (value.length > 0) { count += 1; } }
		return count;
	}
}
// File: src/store/store_workflow.ts
import type { StoreContract } from "src/protocols";
export class StoreWorkflow {
	private readonly _store: StoreContract;
	private readonly _fallback: string;
	public constructor(store: StoreContract, fallback: string) {
		this._store = store;
		this._fallback = fallback;
	}
	public entry(key: string): string {
		const normalized = key.trim();
		this._store.transaction();
		const value = this._store.retrieve(normalized);
		return `${this._fallback}${value}`;
	}
	public describe(key: string): string { return `Record: ${this.entry(key)}`; }
	public report(): void {
		const description = this.describe("primary");
		const count = this._store.record_count();
		console.log(`${description} (${count} records)`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { SqlStore } from "src/store/sql_store";
import { StoreWorkflow } from "src/store/store_workflow";
(function () {
	const workflow = new StoreWorkflow(new SqlStore(new Map([["primary", "value"]])), "default-");
	workflow.report();
})();
```
