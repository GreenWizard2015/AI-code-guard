# `nested-import`

Description: Move imports from functions, methods, classes, and conditional blocks to module scope.

## Bad

```ts
// File: src/item.ts
class Item {
	private readonly label: string;
	public constructor(label: string) {
		this.label = label;
	}
	public normalized_label(): string {
		return this.label.trim();
	}
	public description(): string {
		return `Item ${this.normalized_label()}`;
	}
}
export = Item;
// File: src/item_reporter.ts
import ItemRuntime = require("src/item");
export namespace ItemFeature {
	import Item = require("src/item"); // <- error

	/** Responsibilities: _item report composition_. **/
	export class ItemReporter {
		private readonly prefix: string;
		public constructor(prefix: string) {
			this.prefix = prefix;
		}
		public item_label(): string {
			const item = new ItemRuntime("loaded");
			return item.description();
		}
		public summary(): string {
			return `${this.prefix}: ${this.item_label()}`;
		}
		public report(): void {
			console.log(this.summary());
		}
	}
}
// File: cli.ts
import { ItemFeature } from "src/item_reporter";

(() => {
	const reporter = new ItemFeature.ItemReporter("State");
	reporter.report();
})();
```


## Good

```ts
// File: src/item.ts
export class Item {
	private readonly _label: string;
	private readonly _category: string;
	private readonly _identifier: string;
	private readonly _registered_identifiers: ReadonlySet<string>;
	public constructor(label: string, registered_identifiers: ReadonlySet<string>) {
		this._label = label;
		this._category = "catalog";
		this._identifier = "item-1";
		this._registered_identifiers = registered_identifiers;
	}
	public normalized_label(): string {
		const words = this._label.trim().toLowerCase().split(/\s+/u);
		const normalized_words: string[] = [];
		for (const word of words) {
			if (word.length > 0) { normalized_words.push(word); }
		}
		return normalized_words.join("-");
	}
	public category_label(): string {
		const category = this._category.trim();
		if (this._category.trim().length === 0) { return "UNCATEGORIZED"; }
		return category.toUpperCase();
	}
	public label_length(): number {
		let length = 0;
		for (const character of this.normalized_label()) {
			if (character.trim().length > 0) { length += 1; }
		}
		return length;
	}
	public description(): string {
		const category = this.category_label();
		const label = this.normalized_label();
		const length = this.label_length();
		const registration = this._registered_identifiers.has(this._identifier) ? "registered" : "new";
		return `${this._identifier}: ${category} item ${label} (${length} characters, ${registration})`;
	}
}
// File: src/item_reporter.ts
import { Item } from "src/item";

/** Responsibilities: _item report composition_. **/
export class ItemReporter {
	private readonly _prefix: string;
	private readonly _item: Item;
	public constructor(prefix: string, registered_identifiers: ReadonlySet<string>) {
		this._prefix = prefix;
		this._item = new Item("loaded", registered_identifiers);
	}
	public summary(): string {
		const item_description = this._item.description();
		const item_length = this._item.label_length();
		const clean_prefix = this._prefix.trim().toUpperCase();
		return `${clean_prefix}: ${item_description} [${item_length}]`;
	}
	public status_label(): string {
		const item_length = this._item.label_length();
		if (item_length === 0) { return "empty item"; }
		return `length-${item_length}`;
	}
	public report(): void {
		console.log(`${this.summary()} | ${this.status_label()}`);
	}
}
// File: cli.ts
import { ItemReporter } from "src/item_reporter";

(() => {
	const registered_identifiers = new Set(["item-1"]);
	const reporter = new ItemReporter("State", registered_identifiers);
	reporter.report();
})();
```

