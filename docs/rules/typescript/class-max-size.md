# `class-max-size`

Description: Detect classes too large to keep as one cohesive responsibility.

Fix: Extract cohesive collaborators; do not hide size behind wrappers.

Size averages class-body lines and executable SLOC, excluding signatures and Python docstrings.

## Bad

Fifteen fixed methods each process eight of the same 120 prices.

```ts
// File: src/price_catalog/price_catalog.ts
{% const segments = [{"name":"north","start":0},{"name":"south","start":8},{"name":"east","start":16},{"name":"west","start":24},{"name":"central","start":32},{"name":"coastal","start":40},{"name":"rural","start":48},{"name":"island","start":56},{"name":"metro","start":64},{"name":"northern","start":72},{"name":"southern","start":80},{"name":"highland","start":88},{"name":"lowland","start":96},{"name":"valley","start":104},{"name":"frontier","start":112}] %}
export class PriceCatalog { // <- error
	private readonly multiplier: number;
{%for segment in segments %}
	private {{segment.name}}_total(prices: readonly number[]): number {
		const segment_start = {{segment.start}};
		let total = 0;
		for (let item_number = segment_start; item_number < segment_start + 8; item_number += 1) {
			const extended_price = prices[item_number] * this.multiplier;
			const discounted_price = extended_price - (extended_price * 0.05);
			const price_with_tax = discounted_price + (discounted_price * 0.08);
			total += price_with_tax;
		}
		return total;
	}
{% endfor %}
	public constructor(multiplier: number) { this.multiplier = multiplier; }
	public total(prices: readonly number[]): number {
		const first_segments = this.north_total(prices) + this.south_total(prices) + this.east_total(prices)
			+ this.west_total(prices) + this.central_total(prices) + this.coastal_total(prices) + this.rural_total(prices);
		const remaining_segments = this.island_total(prices) + this.metro_total(prices) + this.northern_total(prices)
			+ this.southern_total(prices) + this.highland_total(prices) + this.lowland_total(prices)
			+ this.valley_total(prices) + this.frontier_total(prices);
		return first_segments + remaining_segments;
	}
	public normalized_total(prices: readonly number[]): number {
		const total = this.total(prices);
		return Math.round(total * 100) / 100;
	}
}
// File: cli.ts
import { PriceCatalog } from "src/price_catalog/price_catalog";
(function () {
	const catalog = new PriceCatalog(1.2);
	const prices = new Array<number>(120);
	prices.fill(1);
	const total = catalog.total(prices);
	const normalized = catalog.normalized_total(prices);
	console.log(total, normalized);
})();
```

## Good

One segment operation replaces the duplicated methods; aggregate the same 120 prices.

```ts
// File: src/price_catalog/price_catalog.ts
/** Responsibilities: _price aggregation_. **/
export class PriceCatalog {
	private readonly multiplier: number;
	/** Responsibilities: _one segment calculation_. **/
	private segment_total(prices: readonly number[], segment_start: number): number {
		let total = 0;
		for (let item_number = segment_start; item_number < segment_start + 8; item_number += 1) {
			const extended_price = prices[item_number] * this.multiplier;
			const discounted_price = extended_price - (extended_price * 0.05);
			const price_with_tax = discounted_price + (discounted_price * 0.08);
			total += price_with_tax;
		}
		return total;
	}
	/** Responsibilities: _catalog initialization_. **/
	public constructor(multiplier: number) { this.multiplier = multiplier; }
	/** Responsibilities: _price aggregation_. **/
	public total(prices: readonly number[]): number {
		let first_segments = 0;
		let remaining_segments = 0;
		for (let segment = 0; segment < 15; segment += 1) {
			const total = this.segment_total(prices, segment * 8);
			if (segment < 7) { first_segments += total; }
			else { remaining_segments += total; }
		}
		return first_segments + remaining_segments;
	}
	/** Responsibilities: _result normalization_. **/
	public normalized_total(prices: readonly number[]): number {
		const total = this.total(prices);
		return Math.round(total * 100) / 100;
	}
}
// File: cli.ts
import { PriceCatalog } from "src/price_catalog/price_catalog";
(function () {
	const catalog = new PriceCatalog(1.2);
	const prices = new Array<number>(120);
	prices.fill(1);
	const total = catalog.total(prices);
	const normalized = catalog.normalized_total(prices);
	console.log(total, normalized);
})();
```
