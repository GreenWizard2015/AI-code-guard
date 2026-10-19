# `class-reference-warning`

Description: Move construction behind one composition owner and expose a narrow contract.

## Bad

The contract exists, but all 15 consumers depend on the concrete implementation.

```ts
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"},{"file":"six","name":"Six"},{"file":"seven","name":"Seven"},{"file":"eight","name":"Eight"},{"file":"nine","name":"Nine"},{"file":"ten","name":"Ten"},{"file":"eleven","name":"Eleven"},{"file":"twelve","name":"Twelve"},{"file":"thirteen","name":"Thirteen"},{"file":"fourteen","name":"Fourteen"},{"file":"fifteen","name":"Fifteen"}] %}
// File: src/product_catalog/protocols.ts
export interface ProductCatalogContract {
	product_name(): string;
}
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
		return `${this.prefix}${this.catalog.product_name()}`;
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


## Good

Consumers depend on the same contract; catalog and consumer behavior stay unchanged.

```ts
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"},{"file":"six","name":"Six"},{"file":"seven","name":"Seven"},{"file":"eight","name":"Eight"},{"file":"nine","name":"Nine"},{"file":"ten","name":"Ten"},{"file":"eleven","name":"Eleven"},{"file":"twelve","name":"Twelve"},{"file":"thirteen","name":"Thirteen"},{"file":"fourteen","name":"Fourteen"},{"file":"fifteen","name":"Fifteen"}] %}
// File: src/product_catalog/protocols.ts
export interface ProductCatalogContract {
	product_name(): string;
}
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
import { ProductCatalogContract } from "src/product_catalog/protocols";
/** Responsibilities: _product presentation_. **/
export class Consumer{{consumer.name}} {
	private readonly catalog: ProductCatalogContract;
	private readonly prefix: string;
	public constructor(catalog: ProductCatalogContract, prefix: string) {
		this.catalog = catalog;
		this.prefix = prefix;
	}
	public display_label(): string {
		return `${this.prefix}${this.catalog.product_name()}`;
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

