# `naming`

Description: Consistent names improve searchability across Python and TypeScript.

Fix: Use `snake_case`, at most three words, for functions, methods, variables, and fields. Use `PascalCase` without underscores for classes, interfaces, enums, and named type aliases.

The same method rule applies to methods declared in project interfaces. External runtime API names remain boundary exceptions.

## Bad

```ts
// File: src/item_inventory.ts
/** Responsibilities: _inventory reporting_. **/
export class ItemInventory {
	private readonly items: readonly string[];
	/** Responsibilities: _inventory initialization_. **/
	public constructor(items: readonly string[]) {
		this.items = items;
	}
	/** Responsibilities: _item counting_. **/
	public item_count(): number {
		return this.items.length;
	}
	/** Responsibilities: _inventory summary formatting_. **/
	public summary(): string {
		const itemCount = this.item_count(); // <- error
		return `Inventory contains ${itemCount} items`;
	}
	/** Responsibilities: _inventory report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ItemInventory } from "src/item_inventory";

(() => {
	const inventory = new ItemInventory(["book", "pen"]);
	inventory.report();
})();
```


## Good

```ts
// File: src/item_inventory.ts
/** Responsibilities: _inventory reporting_. **/
export class ItemInventory {
	private readonly _items: readonly string[];
	/** Responsibilities: _inventory initialization_. **/
	public constructor(items: readonly string[]) {
		this._items = items;
	}
	/** Responsibilities: _item counting_. **/
	public item_count(): number {
		return this._items.length;
	}
	/** Responsibilities: _inventory item membership_. **/
	public contains_item(item_name: string): boolean {
		for (const current_item of this._items) {
			if (current_item === item_name) {
				return true;
			}
		}
		return false;
	}
	/** Responsibilities: _inventory first item label_. **/
	public first_item_label(): string {
		if (this._items.length === 0) {
			return "empty inventory";
		}
		return this._items[0].trim();
	}
	/** Responsibilities: _inventory summary formatting_. **/
	public summary(): string {
		const item_count = this.item_count();
		const first_item = this.first_item_label();
		const has_book = this.contains_item("book");
		return `Inventory contains ${item_count} items; first=${first_item}; book=${has_book}`;
	}
	/** Responsibilities: _inventory report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ItemInventory } from "src/item_inventory";

(() => {
	const inventory = new ItemInventory(["book", "pen"]);
	inventory.report();
})();
```

