# `class-reference-info`

Description: Keep class construction ownership focused and reduce unnecessary cross-file references.

## Bad

Five consumers import the concrete class and use the same behavior.

```ts
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"}] %}
// File: src/product_catalog/product_catalog.ts
export class ProductCatalog {
	private readonly name: string;
	public constructor(name: string) { this.name = name; }
	public product_name(): string { return this.name.trim().toUpperCase(); }
}
{%for consumer in consumers %}
// File: src/consumer_{{consumer.file}}.ts
import { ProductCatalog } from "src/product_catalog/product_catalog"; // <- error
export class Consumer{{consumer.name}} {
	private readonly catalog: ProductCatalog;
	private readonly prefix: string;
	public constructor(catalog: ProductCatalog, prefix: string) {
		this.catalog = catalog;
		this.prefix = prefix;
	}
	public display_label(): string {
		const product_name = this.catalog.product_name();
		return `${this.prefix}${product_name}`;
	}
	public matches_query(query: string): boolean {
		const normalized_product_name = this.catalog.product_name().toLowerCase();
		const normalized_query = query.trim().toLowerCase();
		if (normalized_query.length === 0) { return true; }
		return normalized_product_name.includes(normalized_query);
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
	const consumer_{{consumer.file}} = new Consumer{{consumer.name}}(catalog, "{{consumer.file}}: ");
	console.log(consumer_{{consumer.file}}.display_label(), consumer_{{consumer.file}}.matches_query("note"));
{% endfor %}
})();
```

## Good

Consumers keep the same operations and behavior, but depend on the catalog contract.

```ts
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"}] %}
// File: src/product_catalog/protocols.ts
export interface ProductCatalogContract { product_name(): string; }
// File: src/product_catalog/product_catalog.ts
import type { ProductCatalogContract } from "src/product_catalog/protocols";
/** Responsibilities: _product catalog ownership_. **/
export class ProductCatalog implements ProductCatalogContract {
	private readonly name: string;
	public constructor(name: string) { this.name = name; }
	public product_name(): string { return this.name.trim().toUpperCase(); }
}
{%for consumer in consumers %}
// File: src/consumer_{{consumer.file}}.ts
import type { ProductCatalogContract } from "src/product_catalog/protocols";
/** Responsibilities: _product presentation_. **/
export class Consumer{{consumer.name}} {
	private readonly catalog: ProductCatalogContract;
	private readonly prefix: string;
	public constructor(catalog: ProductCatalogContract, prefix: string) {
		this.catalog = catalog;
		this.prefix = prefix;
	}
	public display_label(): string {
		const product_name = this.catalog.product_name();
		return `${this.prefix}${product_name}`;
	}
	public matches_query(query: string): boolean {
		const normalized_product_name = this.catalog.product_name().toLowerCase();
		const normalized_query = query.trim().toLowerCase();
		if (normalized_query.length === 0) {
			return true;
		}
		return normalized_product_name.includes(normalized_query);
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
	const consumer_{{consumer.file}} = new Consumer{{consumer.name}}(catalog, "{{consumer.file}}: ");
	console.log(consumer_{{consumer.file}}.display_label(), consumer_{{consumer.file}}.matches_query("note"));
{% endfor %}
})();
```
