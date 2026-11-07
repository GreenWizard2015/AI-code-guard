# `relative-import`

Description: Use one explicit import base so file moves do not change dependency resolution.

```ts
import { User } from "../domain/user";
```

Fix: Configure the project to resolve imports from either `{project root}` or
`{project root}/src`, then use an absolute package/module name. Keep the same base in the compiler,
runtime, test runner, bundler, and Python packaging configuration.

For a repository-root layout, TypeScript can use `"baseUrl": "."` and Python can use
`PYTHONPATH=.` (or an installed package). For a `src` layout, use `"baseUrl": "./src"` and
`PYTHONPATH=src` (or an editable package installation). Keep this setting identical in every
runtime and test command.

Do not silence this rule with aliases that still contain `./` or `../`, `sys.path` mutations, or
per-file exceptions. The rule reports every TypeScript module specifier beginning with `./` or
`../` (including `import = require(...)`) and every Python `from` import with one or more leading
relative-import dots.

## Bad

```ts
// File: src/domain/item.ts
export class Item {
	private readonly identifier: string;
	private readonly title: string;
	public constructor(identifier: string, title: string) {
		this.identifier = identifier;
		this.title = title;
	}
	public normalized_title(): string {
		return this.title.trim().toUpperCase();
	}
	public is_available(): boolean {
		return this.normalized_title().length > 0;
	}
	public label(): string {
		const title = this.normalized_title();
		const availability = this.is_available() ? "listed" : "hidden";
		return `${this.identifier}: ${title} (${availability})`;
	}
}
// File: src/catalog/item_card.ts
import { Item } from "../domain/item"; // <- error

export class ItemCard {
	private readonly item: Item;
	public constructor(identifier: string, title: string) {
		this.item = new Item(identifier, title);
	}
	public display_name(): string {
		const item_label = this.item.label();
		return `Catalog item: ${item_label}`;
	}
	public is_listed(): boolean {
		const label = this.display_name();
		const has_label = label.trim().length > 0;
		return has_label && this.item.is_available();
	}
	public report(): void {
		const label = this.display_name();
		const listed = this.is_listed();
		console.log(`${label} | listed=${listed}`);
	}
}
// File: cli.ts
import { ItemCard } from "src/catalog/item_card";
(function () {
	const card = new ItemCard("item-1", "Field Guide");
	card.report();
})();
```

## Good

```ts
// File: src/domain/item.ts
export class Item {
	private readonly _title_cache: Map<string, string>;
	private readonly _identifier: string;
	private readonly _title: string;
	public constructor(identifier: string, title: string) {
		this._identifier = identifier;
		this._title = title;

		this._title_cache = new Map();}
	public normalized_title(): string {
		const cached = this._title_cache.get(this._title);
		if (cached !== undefined) { return cached; }
		const title = this._title.trim().toUpperCase();
		this._title_cache.set(this._title, title);
		return title;
	}
	public available(): boolean {
		return this.normalized_title().length > 0;
	}
	public label(): string {
		const title = this.normalized_title();
		if (this.available()) {
			return `${this._identifier}: ${title} (listed)`;
		}
		return `${this._identifier}: ${title} (hidden)`;
	}
}
// File: src/domain/item_card.ts
import { Item } from "src/domain/item";

export class ItemCard {
	private readonly _item: Item;
	public constructor(identifier: string, title: string) {
		this._item = new Item(identifier, title);
	}
	public display_name(): string {
		const item_label = this._item.label();
		return `Catalog item: ${item_label}`;
	}
	public listed(): boolean {
		const label = this.display_name();
		if (label.trim().length === 0) {
			return false;
		}
		return this._item.available();
	}
	public report(): void {
		const label = this.display_name();
		const listed = this.listed();
		console.log(`${label} | listed=${listed}`);
	}
}
// File: cli.ts
import { ItemCard } from "src/domain/item_card";
(function () {
	const card = new ItemCard("item-1", "Field Guide");
	card.report();
})();
```

