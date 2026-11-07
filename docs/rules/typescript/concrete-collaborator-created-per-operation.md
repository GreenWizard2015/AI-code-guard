# Concrete collaborator created per operation

Description: A method chooses a concrete class implementing a project interface, constructs it for one operation, and calls it through that interface. Create the collaborator at the composition boundary and inject the interface instead.

## Bad

```ts
// File: src/product_catalog/protocols.ts
export interface ProductCatalogContract { product_name(): string; name_count(): number; }
// File: src/product_catalog/product_catalog.ts
import type { ProductCatalogContract } from "src/product_catalog/protocols";
export class ProductCatalog implements ProductCatalogContract {
	private readonly names: readonly string[];
	public constructor(names: readonly string[]) { this.names = names; }
	public product_name(): string { return this.names[0] ?? "Empty"; }
	public name_count(): number { return this.names.length; }
}
// File: src/product_shelf/product_shelf.ts
import { ProductCatalog } from "src/product_catalog/product_catalog";
import type { ProductCatalogContract } from "src/product_catalog/protocols";
export class ProductShelf {
	private readonly label: string;
	public constructor(label: string) { this.label = label; }
	public title(): string {
		const catalog: ProductCatalogContract = new ProductCatalog([this.label]); // <- error
		return catalog.product_name();
	}
	public visible_count(): number {
		const catalog: ProductCatalogContract = new ProductCatalog([this.label]); // <- error
		return catalog.name_count();
	}
	public report(): void {
		const title = this.title();
		const count = this.visible_count();
		console.log(`${title} (${count})`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { ProductShelf } from "src/product_shelf/product_shelf";
(function () {
	const shelf = new ProductShelf("Favorites");
	shelf.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface ProductCatalogContract {
	product_name(): string;
	contains(query: string): boolean;
	name_count(): number;
}
// File: src/product_catalog/product_catalog.ts
import type { ProductCatalogContract } from "src/protocols";
export class ProductCatalog implements ProductCatalogContract {
	private readonly _names: readonly string[];
	private readonly _fallback: string;
	public constructor(names: readonly string[], fallback: string) { this._names = names; this._fallback = fallback; }
	public product_name(): string {
		for (const name of this._names) { if (name.length > 0) { return name; } }
		return this._fallback;
	}
	public contains(query: string): boolean {
		for (const name of this._names) { if (name.toLowerCase().includes(query)) { return true; } }
		return false;
	}
	public name_count(): number {
		let count = 0;
		for (const name of this._names) { if (name.length > 0) { count += 1; } }
		return count;
	}
}
// File: src/product_shelf/product_shelf.ts
import type { ProductCatalogContract } from "src/protocols";
export class ProductShelf {
	private readonly _catalog: ProductCatalogContract;
	private readonly _label: string;
	private readonly _maximum_label_length: number;
	public constructor(catalog: ProductCatalogContract, label: string, maximum_label_length: number) {
		this._catalog = catalog;
		this._label = label;
		this._maximum_label_length = maximum_label_length;
	}
	public title(): string { return `${this._label}: ${this._catalog.product_name()}`; }
	public includes(query: string): boolean {
		const normalized = query.trim().toLowerCase();
		if (normalized.length === 0) { return false; }
		if (this._catalog.contains(normalized)) { return true; }
		return this._catalog.product_name().toLowerCase().includes(normalized);
	}
	public display_label(): string {
		if (this._label.length <= this._maximum_label_length) { return this._label; }
		return this._label.slice(0, this._maximum_label_length);
	}
	public visible_count(): number {
		let count = this._catalog.name_count();
		if (this.display_label().length > 0) { count += 1; }
		return count;
	}
	public report(): void {
		const title = this.title();
		const matches = this.includes("note");
		const count = this.visible_count();
		console.log(`${title} | matches=${matches} | visible=${count}`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { ProductCatalog } from "src/product_catalog/product_catalog";
import { ProductShelf } from "src/product_shelf/product_shelf";
(function () {
	const shelf = new ProductShelf(new ProductCatalog(["Notebook", "Pencil"], "Empty"), "Favorites", 20);
	shelf.report();
})();
```
