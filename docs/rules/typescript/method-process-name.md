# `method-process-name`

Description: Review public commands beginning with `process*`. The name often hides several
actions: `processPayment()` may validate, authorize, charge, store, and notify.
Replace it with the concrete domain action or split the responsibilities.
`process` may remain at a genuine generic processing boundary.

## Bad

```ts
class PriceLabels {
	public process_payment(): string { return "value"; }
}
```


## Good

```ts
// File: src/price_labels.ts
/** Responsibilities: _price label mapping_. **/
export class PriceLabels {
	private readonly prices: ReadonlyMap<string, string>;
	private readonly fallback: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(prices: ReadonlyMap<string, string>, fallback: string) {
		this.prices = prices;
		this.fallback = fallback;
	}

	/** Responsibilities: _price label selection_. **/
	public price_label(price_code: string): string {
		const label = this.prices.get(price_code);
		if (label === undefined) {
			return this.fallback;
		}
		return label;
	}

	/** Responsibilities: _prefixed label composition_. **/
	public prefixed_price_label(prefix: string, price_code: string): string {
		const label = this.price_label(price_code);
		return `${prefix}: ${label}`;
	}

	/** Responsibilities: _fallback capitalization_. **/
	public formatted_fallback(): string {
		const normalized = this.fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _mapping size reporting_. **/
	public price_count(): number {
		let count = 0;
		for (const price_code of this.prices.keys()) {
			if (price_code.length > 0) {
				count += 1;
			}
		}
		return count;
	}
}
// File: cli.ts
import { PriceLabels } from "src/price_labels";

(function () {
	const prices = new Map<string, string>();
	prices.set("sale", "Sale");
	prices.set("tax", "Tax");
	const price_labels = new PriceLabels(prices, "Unknown");
	const label = price_labels.price_label("sale");
	const detailed = price_labels.prefixed_price_label("State", "tax");
	const fallback = price_labels.formatted_fallback();
	const count = price_labels.price_count();
	console.log(`${label} ${detailed} ${fallback} ${count}`);
})();
```
