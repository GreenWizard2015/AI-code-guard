# `class-reference-info`

Description: Keep class construction ownership focused and reduce unnecessary cross-file references.

## Bad

```ts
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"}] %}
// File: src/product_catalog/product_catalog.ts
export class ProductCatalog {
	private readonly name: string;
	public constructor(name: string) {
		this.name = name.trim();
	}
	public product_name(): string {
		const trimmed_name = this.name.trim();
		if (trimmed_name.length === 0) { return "Uncatalogued"; }
		const words = trimmed_name.split(/\s+/u);
		return words.join(" ").toUpperCase();
	}
	public matches_query(query: string): boolean {
		const normalized_query = query.trim().toLowerCase();
		if (normalized_query.length === 0) { return false; }
		const words = this.name.trim().replace(/\s+/gu, " ").toLowerCase().split(" ");
		for (const word of words) {
			if (word === normalized_query) { return true; }
		}
		return false;
	}
}
{%for consumer in consumers %}
// File: src/consumer_{{consumer.file}}.ts
import { ProductCatalog } from "src/product_catalog/product_catalog"; // <- error
export class Consumer{{consumer.name}} {
	private readonly catalog: ProductCatalog;
	public constructor(catalog: ProductCatalog) {
		this.catalog = catalog;
	}
	public matches_query(query: string): boolean {
		const normalized_product_name = this.catalog.product_name().toLowerCase();
		const normalized_query = query.trim().toLowerCase();
		if (normalized_query.length === 0) { return true; }
		return normalized_product_name.includes(normalized_query);
	}
	public report(): void {
		const label = this.catalog.product_name();
		const matches = this.matches_query("note");
		console.log(label, matches);
	}
}
{% endfor %}
// File: src/cli.ts
import { ProductCatalog } from "src/product_catalog/product_catalog";
{%for consumer in consumers %}
import { Consumer{{consumer.name}} } from "src/consumer_{{consumer.file}}";
{% endfor %}
(function () {
	const catalog = new ProductCatalog("Notebook");
{%for consumer in consumers %}
	const consumer_{{consumer.file}} = new Consumer{{consumer.name}}(catalog);
	consumer_{{consumer.file}}.report();
{% endfor %}
})();
```

## Good

```ts
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"}] %}
// File: src/product_catalog/protocols.ts
export interface ProductCatalogContract {
	product_name(): string;
	matches_query(query: string): boolean;
}
// File: src/product_catalog/product_catalog.ts
import type { ProductCatalogContract } from "src/product_catalog/protocols";
/** Responsibilities: _product catalog ownership_. **/
export class ProductCatalog implements ProductCatalogContract {
	private readonly _name: string;
	public constructor(name: string) {
		this._name = name.trim();
	}
	public product_name(): string {
		const trimmed_name = this._name.trim();
		if (trimmed_name.length === 0) { return "Uncatalogued"; }
		const words = trimmed_name.split(/\s+/u);
		return words.join(" ").toUpperCase();
	}
	public matches_query(query: string): boolean {
		const normalized_query = query.trim().toLowerCase();
		if (normalized_query.length === 0) { return false; }
		const words = this._name.trim().replace(/\s+/gu, " ").toLowerCase().split(" ");
		for (const word of words) {
			if (word === normalized_query) { return true; }
		}
		return false;
	}
}
{%for consumer in consumers %}
// File: src/consumer_{{consumer.file}}.ts
import type { ProductCatalogContract } from "src/product_catalog/protocols";
/** Responsibilities: _product presentation_. **/
export class Consumer{{consumer.name}} {
	private readonly _catalog: ProductCatalogContract;
	public constructor(catalog: ProductCatalogContract) {
		this._catalog = catalog;
	}
	public matches_query(query: string): boolean {
		const normalized_product_name = this._catalog.product_name().toLowerCase();
		const normalized_query = query.trim().toLowerCase();
		if (normalized_query.length === 0) {
			return true;
		}
		return normalized_product_name.includes(normalized_query);
	}
	public report(): void {
		const label = this._catalog.product_name();
		const matches = this.matches_query("note");
		console.log(label, matches);
	}
}
{% endfor %}
// File: src/cli.ts
import { ProductCatalog } from "src/product_catalog/product_catalog";
{%for consumer in consumers %}
import { Consumer{{consumer.name}} } from "src/consumer_{{consumer.file}}";
{% endfor %}
(function () {
	const catalog = new ProductCatalog("Notebook");
{%for consumer in consumers %}
	const consumer_{{consumer.file}} = new Consumer{{consumer.name}}(catalog);
	consumer_{{consumer.file}}.report();
{% endfor %}
})();
```
