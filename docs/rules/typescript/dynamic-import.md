# `dynamic-import`

Description: Use static imports for project-owned dependencies so the dependency graph and
module contract remain visible at analysis time.

## Bad

```ts
// File: src/item.ts
export const ITEM_LABEL = "item loaded";
// File: src/item_reporter.ts
/** Responsibilities: _item label reporting_. **/
export class ItemReporter {
	private readonly prefix: string;
	/** Responsibilities: _reporter initialization_. **/
	public constructor(prefix: string) {
		this.prefix = prefix;
	}
	/** Responsibilities: _dynamic item name lookup_. **/
	public async resolve_name(): Promise<string> {
		const item_module = await import("src/item"); // <- error
		return item_module.ITEM_LABEL.trim();
	}
	/** Responsibilities: _item label formatting_. **/
	public async format_label(): Promise<string> {
		return `${this.prefix}: ${await this.resolve_name()}`;
	}
	/** Responsibilities: _item label output_. **/
	public async report(): Promise<void> {
		console.log(await this.format_label());
	}
}
// File: cli.ts
import { ItemReporter } from "src/item_reporter";

(async () => {
	const reporter = new ItemReporter("State");
	await reporter.report();
})();
```

## Good

```ts
// File: src/item.ts
export class Item {
	private readonly _label: string;
	private readonly _category: string;
	private readonly _identifier: string;

	public constructor(label: string, category: string, identifier: string) {
		this._label = label;
		this._category = category;
		this._identifier = identifier;
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
		const clean_category = this._category.trim();
		if (this._category.trim().length === 0) { return "UNCATEGORIZED"; }
		return clean_category.toUpperCase();
	}

	public description(): string {
		const category = this.category_label();
		const label = this.normalized_label();
		return `${category}: ${this._identifier.trim()} ${label}`;
	}

}
// File: src/item_reporter.ts
import { Item } from "src/item";

/** Responsibilities: _item label reporting_. **/
export class ItemReporter {
	private readonly _prefix: string;
	private readonly _item: Item;
	/** Responsibilities: _reporter initialization_. **/
	public constructor(prefix: string) {
		this._prefix = prefix;
		this._item = new Item("item loaded", "catalog", "item-1");
	}
	/** Responsibilities: _item category and description composition_. **/
	public category_summary(): string {
		return `${this._item.category_label()} | ${this._item.description()}`;
	}
	/** Responsibilities: _item word count calculation_. **/
	public word_count(): number {
		const item_words = this._item.normalized_label().split(/\s+/u);
		return item_words.length;
	}
	/** Responsibilities: _item summary composition_. **/
	public summary(): string {
		return `${this._prefix}: ${this.category_summary()} (${this.word_count()} words)`;
	}
	/** Responsibilities: _item label formatting_. **/
	public format_label(): string {
		return this.summary().toUpperCase();
	}
	/** Responsibilities: _item label output_. **/
	public report(): void {
		console.log(this.format_label());
	}
}
// File: cli.ts
import { ItemReporter } from "src/item_reporter";

(() => {
	const reporter = new ItemReporter("State");
	reporter.report();
})();
```
