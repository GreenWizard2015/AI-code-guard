# `method-set-name`

Description: See the examples below for the rule behavior.

### `set*`

`set` usually exposes a mutable data holder: callers learn the object's fields
and directly control its state.

```java
setName(...)
setStatus(...)
setPrice(...)
setOwner(...)
```

Prefer a domain command when the change is a real business action:

```java
setStatus(APPROVED)  →  approve()
setOwner(user)       →  assign(user)
```

If the changed value is part of the object's identity, prefer a new immutable
object instead of mutating the existing one. The rule is a design prompt, not
a ban on every setter: a technical adapter or genuine configuration property
may need `set_timeout`.

## Bad

```ts
class PriceLabels {
	public set_price(price: number): void { void price; }
}
```


## Good

```ts
// File: src/price_labels.ts
/** Responsibilities: _price label mapping_. **/
export class PriceLabels {
	private readonly prices: Map<string, string>;
	private readonly fallback: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(prices: Map<string, string>, fallback: string) {
		this.prices = prices;
		this.fallback = fallback;
	}

	/** Responsibilities: _creating an updated price catalog_. **/
	public record_price(price_code: string, label: string): number {
		const normalized_code = price_code.trim().toLowerCase();
		const normalized_label = label.trim();
		this.prices.set(normalized_code, normalized_label);
		return this.prices.size;
	}

	/** Responsibilities: _price label selection_. **/
	public price_label(price_code: string): string {
		const normalized_code = price_code.trim().toLowerCase();
		const label = this.prices.get(normalized_code);
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

}
// File: cli.ts
import { PriceLabels } from "src/price_labels";

(function () {
	const prices = new Map<string, string>();
	prices.set("sale", "Sale");
	prices.set("tax", "Tax");
	const price_labels = new PriceLabels(prices, "Unknown");
	const recorded_count = price_labels.record_price("discount", "Discount");
	const label = price_labels.price_label("sale");
	const detailed = price_labels.prefixed_price_label("State", "tax");
	console.log(`${label} ${detailed} ${recorded_count}`);
})();
```
