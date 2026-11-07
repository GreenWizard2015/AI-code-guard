# `class-reference-warning`

Description: Let consumers depend on a narrow contract, not its concrete implementation.

## Bad

```ts
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"},{"file":"six","name":"Six"},{"file":"seven","name":"Seven"},{"file":"eight","name":"Eight"},{"file":"nine","name":"Nine"},{"file":"ten","name":"Ten"},{"file":"eleven","name":"Eleven"},{"file":"twelve","name":"Twelve"},{"file":"thirteen","name":"Thirteen"},{"file":"fourteen","name":"Fourteen"},{"file":"fifteen","name":"Fifteen"}] %}
// File: src/product_catalog/protocols.ts
export interface ProductCatalogContract {
	product_name(): string;
}
// File: src/product_catalog/product_catalog.ts
import type { ProductCatalogContract } from "src/product_catalog/protocols";
export class ProductCatalog implements ProductCatalogContract {
	private readonly name: string;
	public constructor(name: string) {
		this.name = name.trim();
	}
	public normalized_name(): string {
		const words = this.name.split(/\s+/u).filter((word) => word.length > 0);
		return words.join(" ");
	}
	public product_name(): string {
		const normalized_name = this.normalized_name();
		if (normalized_name.length === 0) { return "Uncatalogued"; }
		return normalized_name.toUpperCase();
	}
	public report(message: string): void {
		console.log(`Catalog: ${this.product_name()} | ${message}`);
	}
}
{%for consumer in consumers %}
// File: src/consumer_{{consumer.file}}.ts
import { ProductCatalog } from "src/product_catalog/product_catalog"; // <- error
export class Consumer{{consumer.name}} {
	private readonly catalog: ProductCatalog;
	private readonly prefix: string;
	private readonly query: string;
	public constructor(catalog: ProductCatalog, prefix: string, query: string) {
		this.catalog = catalog;
		this.prefix = prefix;
		this.query = query;
	}
	public report_line(): string {
		return `${this.display_label()} | match=${this.matches_query()}`;
	}
	public matches_query(): boolean {
		return this.query.trim().length > 0 && this.display_label().toLowerCase().includes(this.query.trim().toLowerCase());
	}
	public display_label(): string {
		return `${this.prefix.trim()}: ${this.catalog.product_name()}`;
	}
}
{% endfor %}
// File: cli.ts
import { ProductCatalog } from "src/product_catalog/product_catalog";
{%for consumer in consumers %}
import { Consumer{{consumer.name}} } from "src/consumer_{{consumer.file}}";
{% endfor %}

(function () {
	const reporter = new ProductCatalog("report");
{%for consumer in consumers %}
	const consumer_{{consumer.file}} = new Consumer{{consumer.name}}(reporter, "prefix-{{consumer.file}}", "query-{{consumer.file}}");
	reporter.report(consumer_{{consumer.file}}.report_line());
{% endfor %}
})();
```

## Good

```ts
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"},{"file":"six","name":"Six"},{"file":"seven","name":"Seven"},{"file":"eight","name":"Eight"},{"file":"nine","name":"Nine"},{"file":"ten","name":"Ten"},{"file":"eleven","name":"Eleven"},{"file":"twelve","name":"Twelve"},{"file":"thirteen","name":"Thirteen"},{"file":"fourteen","name":"Fourteen"},{"file":"fifteen","name":"Fifteen"}] %}
// File: src/product_catalog/protocols.ts
export interface ProductCatalogContract {
	product_name(): string;
}
// File: src/product_catalog/product_catalog.ts
import type { ProductCatalogContract } from "src/product_catalog/protocols";
export class ProductCatalog implements ProductCatalogContract {
	private readonly _name: string;
	public constructor(name: string) {
		this._name = name.trim();
	}
	public normalized_name(): string {
		const words = this._name.split(/\s+/u).filter((word) => word.length > 0);
		return words.join(" ");
	}
	public product_name(): string {
		const normalized_name = this.normalized_name();
		if (normalized_name.length === 0) { return "Uncatalogued"; }
		return normalized_name.toUpperCase();
	}
	public report(message: string): void {
		console.log(`Catalog: ${this.product_name()} | ${message}`);
	}
}
{%for consumer in consumers %}
// File: src/consumer_{{consumer.file}}.ts
import type { ProductCatalogContract } from "src/product_catalog/protocols";
export class Consumer{{consumer.name}} {
	private readonly _catalog: ProductCatalogContract;
	private readonly _prefix: string;
	private readonly _query: string;
	public constructor(catalog: ProductCatalogContract, prefix: string, query: string) {
		this._catalog = catalog;
		this._prefix = prefix;
		this._query = query;
	}
	public display_label(): string {
		return `${this._prefix.trim()}: ${this._catalog.product_name()}`;
	}
	public matches_query(): boolean {
		const query = this._query.trim().toLowerCase();
		const label = this.display_label().toLowerCase();
		return query.length > 0 && label.includes(query);
	}
	public report_line(): string {
		return `${this.display_label()} | match=${this.matches_query()}`;
	}
}
{% endfor %}
// File: cli.ts
import { ProductCatalog } from "src/product_catalog/product_catalog";
{%for consumer in consumers %}
import { Consumer{{consumer.name}} } from "src/consumer_{{consumer.file}}";
{% endfor %}

(function () {
	const reporter = new ProductCatalog("report");
{%for consumer in consumers %}
	const consumer_{{consumer.file}} = new Consumer{{consumer.name}}(reporter, "prefix-{{consumer.file}}", "query-{{consumer.file}}");
	reporter.report(consumer_{{consumer.file}}.report_line());
{% endfor %}
})();
```
