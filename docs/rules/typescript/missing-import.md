# `missing-import`

Description: Restore an unresolved module or update the import to the module's current owner.

## Bad

```ts
// File: src/catalog_item.ts
export class CatalogItem {
	public readonly label: string;
	public readonly category: string;
	public constructor(label: string, category: string) {
		this.label = label;
		this.category = category;
	}
	public heading(): string {
		const clean_label = this.label.trim();
		const clean_category = this.category.trim();
		return `${clean_category.toUpperCase()}: ${clean_label}`;
	}
	public word_count(): number {
		const words = this.label.trim().split(/\\s+/u);
		return words.length;
	}
	public character_count(): number {
		const clean_label = this.label.trim();
		let count = 0;
		for (const character of clean_label) { count += 1; }
		return count;
	}
	public description(): string {
		const item_heading = this.heading();
		const words = this.word_count();
		const characters = this.character_count();
		return `${item_heading} (${words} words, ${characters} characters)`;
	}
	public report(): void {
		console.log(this.description());
	}
}
// File: src/catalog_record.ts
import type { CatalogEntry } from "./catalog_entry"; // <- error

export class CatalogRecord {
	private readonly item: CatalogEntry;
	private readonly source_label: string;
	public constructor(item: CatalogEntry, source_label: string) {
		this.item = item;
		this.source_label = source_label;
	}
	public heading_line(): string {
		const heading = this.item.heading();
		const description = this.item.description();
		const source = this.source_label.trim();
		return `${source}: ${heading} | ${description}`;
	}
	public label_length(): number {
		let visible_characters = 0;
		for (const character of this.item.label.trim()) {
			if (character.trim().length > 0) { visible_characters += 1; }
		}
		return visible_characters;
	}
	public report(): void {
		const heading = this.heading_line();
		const length = this.label_length();
		console.log(`${heading} (${length} characters)`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { CatalogItem } from "src/catalog_item";
import type { CatalogRecord } from "./catalog_record";

(() => {
	const item = new CatalogItem("item loaded", "catalog");
	item.report();
})();
```

## Good

```ts
// File: src/catalog_item.ts
export class CatalogItem {
	public readonly _label: string;
	public readonly _category: string;
	public constructor(label: string, category: string) {
		this._label = label;
		this._category = category;
	}
	public heading(): string {
		const clean_label = this._label.trim();
		const clean_category = this._category.trim();
		if (this._label.trim().length === 0) {
			return `${clean_category.toUpperCase()}:`;
		}
		return `${clean_category.toUpperCase()}: ${clean_label}`;
	}
	public word_count(): number {
		const words = this._label.trim().split(/\s+/u);
		let count = 0;
		for (const word of words) {
			if (word.length > 0) { count += 1; }
		}
		return count;
	}
	public character_count(): number {
		let count = 0;
		for (const character of this._label.trim()) { count += 1; }
		return count;
	}
	public description(): string {
		const heading = this.heading();
		const words = this.word_count();
		const characters = this.character_count();
		return `${heading} (${words} words, ${characters} characters)`;
	}
	public report(): void {
		const heading = this.heading();
		const details = this.description();
		console.log(`${heading} | ${details}`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { CatalogItem } from "src/catalog_item";

(() => {
	const item = new CatalogItem("item loaded", "catalog");
	item.report();
})();
```
