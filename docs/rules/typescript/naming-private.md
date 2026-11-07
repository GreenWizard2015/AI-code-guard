# `naming-private`

Description: Names must not begin with `_`.

Allowed exceptions:

- class fields;
- private methods;
- names made only of underscores, such as `_` or `__`.

Type fields in interfaces and object type aliases must not start with `_`. This applies to module-level symbols, parameters, types, classes, public and protected methods, and local variables. Do not hide a leading underscore behind an alias.

## Bad

```ts
// File: src/item_reporter.ts
export class ItemReporter {
	private readonly item_counts: number[];
	public constructor(item_counts: number[]) {
		this.item_counts = [...item_counts];
	}
	public add_item(item_count: number): void {
		this.item_counts.push(item_count);
	}
	public count_items(): number {
		let total = 0;
		for (const item_count of this.item_counts) { total += item_count; }
		return total;
	}
	public average_item_count(): number {
		if (this.item_counts.length === 0) { return 0; }
		return this.count_items() / this.item_counts.length;
	}
	public report_item_count(): void {
		console.log(`item count: ${this.count_items()} (average ${this.average_item_count()})`);
	}
}
// File: src/types.ts
export type ItemRequest = { _item_id: number; };
// File: src/cli.ts
import { ItemReporter } from "src/item_reporter";
import type { ItemRequest } from "src/types";

(function () {
	const reporter = new ItemReporter([]);
	const request: ItemRequest = { _item_id: 1 };
	reporter.add_item(request._item_id);
	reporter.add_item(2);
	reporter.report_item_count();
})();
```


## Good

```ts
// File: src/item_reporter.ts
export class ItemReporter {
	private readonly _item_counts: number[];
	public constructor(item_counts: number[]) {
		this._item_counts = [...item_counts];
	}
	public add_item(item_count: number): void {
		this._item_counts.push(item_count);
	}
	public count_items(): number {
		let total = 0;
		for (const item_count of this._item_counts) { total += item_count; }
		return total;
	}
	public average_item_count(): number {
		if (this._item_counts.length === 0) { return 0; }
		return this.count_items() / this._item_counts.length;
	}
	public report_item_count(): void {
		console.log(`item count: ${this.count_items()} (average ${this.average_item_count()})`);
	}
}
// File: src/types.ts
export type ItemRequest = { item_id: number; };
// File: src/cli.ts
import { ItemReporter } from "src/item_reporter";
import type { ItemRequest } from "src/types";

(function () {
	const reporter = new ItemReporter([]);
	const request: ItemRequest = { item_id: 1 };
	reporter.add_item(request.item_id);
	reporter.add_item(2);
	reporter.report_item_count();
})();
```

