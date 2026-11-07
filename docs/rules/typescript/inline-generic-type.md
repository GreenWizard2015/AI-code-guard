# `inline-generic-type`

Description: Anonymous generic arguments make nested contracts hard to read.

```ts
Promise<{ id: string }>
```

Python generic arguments should also use named contracts:


Fix: Name the result shape first, then use `Promise<Result>`.

## Bad

```ts
// File: src/item_reader.ts
export class ItemReader {
	private readonly prefix: string;

	public constructor(prefix: string) {
		this.prefix = prefix;
	}

	public async item_id(value: Promise<{ id: string }>): Promise<string> {
		const item = await value;
		return item.id;
	}

	public format_item_id(item_id: string): string {
		const normalized_id = item_id.trim();
		return `${this.prefix}:${normalized_id}`;
	}

	public async report(): Promise<void> {
		const item_id = await this.item_id(Promise.resolve({ id: "item-1" }));
		console.log(this.format_item_id(item_id));
	}
}
// File: cli.ts
import { ItemReader } from "src/item_reader";

(() => {
	const reader = new ItemReader("item");
	void reader.report();
})();
```


## Good

```ts
// File: src/types.ts
export type ItemResult = { id: string; name: string };
// File: src/item_catalog.ts
import type { ItemResult } from "src/types";

export class ItemCatalog {
	private readonly _items: Map<string, ItemResult>;

	public constructor() {
		this._items = new Map<string, ItemResult>();
	}

	public add_result(result: ItemResult): void {
		const normalized_id = result.id.trim().toLowerCase();
		const normalized_name = result.name.trim();
		this._items.set(normalized_id, { id: normalized_id, name: normalized_name });
	}

	public summary(): string {
		const entries: string[] = [];
		for (const item of this._items.values()) {
			const item_name = item.name.trim();
			entries.push(`${item.id}: ${item_name}`);
		}
		return entries.join(" | ");
	}

	public item_ids(): string[] {
		const identifiers: string[] = [];
		for (const item_id of this._items.keys()) {
			identifiers.push(item_id);
		}
		return identifiers;
	}

	public report(): void {
		const item_summary = this.summary();
		const identifiers = this.item_ids();
		const entry_count = identifiers.length;
		console.log(`${entry_count} catalog entries (${identifiers.join(", ")}): ${item_summary}`);
	}
}
// File: cli.ts
import { ItemCatalog } from "src/item_catalog";

(() => {
	const catalog = new ItemCatalog();
	catalog.add_result({ id: "item-1", name: "Notebook" });
	catalog.add_result({ id: "item-2", name: "Pen" });
	catalog.report();
})();
```

