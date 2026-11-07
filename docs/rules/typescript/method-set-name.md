# `method-set-name`

Description: Prefer domain operations to generic `set_*` methods that expose a mutable data holder. Use setters for genuine configuration properties; model business transitions with commands such as `approve()` or `assign()`.

## Bad

```ts
// File: src/price_labels.ts
export class PriceLabels {
	private readonly prices: Map<string, string>;
	private readonly fallback: string;

	public constructor(prices: Map<string, string>, fallback: string) {
		this.prices = prices;
		this.fallback = fallback;
	}

	public set_price(price_code: string, label: string): void {
		const normalized_code = price_code.trim().toLowerCase();
		this.prices.set(normalized_code, label.trim());
	}

	public price_label(price_code: string): string {
		const normalized_code = price_code.trim().toLowerCase();
		const label = this.prices.get(normalized_code);
		if (label === undefined) {
			return this.fallback;
		}
		return label;
	}

	/** Responsibilities: _prefixed price label composition_. **/
	public prefixed_price_label(prefix: string, price_code: string): string {
		const label = this.price_label(price_code);
		return `${prefix}: ${label}`;
	}

	public price_count(): number {
		let count = 0;
		for (const code of this.prices.keys()) {
			if (code.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	public report(): void {
		this.set_price("discount", "Discount");
		const label = this.price_label("discount");
		const count = this.price_count();
		console.log(`${label} (${count} prices)`);
	}
}
// File: cli.ts
import { PriceLabels } from "src/price_labels";

(function run(): void {
	const prices = new Map<string, string>([["sale", "Sale"]]);
	const labels = new PriceLabels(prices, "Unknown");
	labels.report();
})();
```


## Good

```ts
// File: src/price_labels.ts
/** Responsibilities: _price label mapping_. **/
export class PriceLabels {
	private readonly _prices: Map<string, string>;
	private readonly _fallback: string;
	private readonly _price_code: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(prices: Map<string, string>, fallback: string, price_code: string) {
		this._prices = prices;
		this._fallback = fallback;
		this._price_code = price_code;
	}

	/** Responsibilities: _creating an updated price catalog_. **/
	public record_price(label: string): number {
		const normalized_code = this._price_code.trim().toLowerCase();
		const normalized_label = label.trim();
		this._prices.set(normalized_code, normalized_label);
		return this._prices.size;
	}

	/** Responsibilities: _price label selection_. **/
	public price_label(): string {
		const normalized_code = this._price_code.trim().toLowerCase();
		const label = this._prices.get(normalized_code);
		if (label === undefined) {
			return this._fallback;
		}
		return label;
	}

	/** Responsibilities: _prefixed price label composition_. **/
	public prefixed_price_label(prefix: string): string {
		const label = this.price_label();
		return `${prefix}: ${label}`;
	}

	/** Responsibilities: _price overview reporting_. **/
	public report(): void {
		const recorded_count = this.record_price("Discount");
		const label = this.price_label();
		const detailed = this.prefixed_price_label("State");
		console.log(`${label} ${detailed} ${recorded_count}`);
	}

}
// File: cli.ts
import { PriceLabels } from "src/price_labels";

(function () {
	const prices = new Map<string, string>();
	prices.set("sale", "Sale");
	prices.set("tax", "Tax");
	const price_labels = new PriceLabels(prices, "Unknown", "discount");
	price_labels.report();
})();
```
