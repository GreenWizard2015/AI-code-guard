# `method-get-name`

Description: Review public non-boolean result methods beginning with `get*`. The name
usually exposes getter-style access to a mutable data holder. Prefer the
returned value: `getPrice()` → `price()` and `getUser(id)` → `user(id)`.

This is a review signal, not a ban at a technical adapter boundary.

## Bad

```ts
// File: src/price_quote.ts
export class PriceQuote {
	private readonly item_label: string;
	private readonly amount: number;
	private readonly tax_rate: number;
	public constructor(item_label: string, amount: number, tax_rate: number) {
		this.item_label = item_label;
		this.amount = amount;
		this.tax_rate = tax_rate;
	}
	public get_price(): number { return this.amount; } // <- error
	public price_with_tax(): number {
		const tax_amount = this.amount * this.tax_rate;
		return this.amount + tax_amount;
	}
	public summary(): string {
		const base_price = this.get_price();
		const taxed_price = this.price_with_tax();
		return `${this.item_label}: ${base_price} / ${taxed_price}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { PriceQuote } from "src/price_quote";
(function () {
	const quote = new PriceQuote("Notebook", 12, 0.08);
	quote.report();
})();
```

## Good

```ts
// File: src/price_quote.ts
export class PriceQuote {
	private readonly _item_label: string;
	private readonly _amount: number;
	private readonly _tax_rate: number;
	public constructor(item_label: string, amount: number, tax_rate: number) {
		this._item_label = item_label;
		this._amount = amount;
		this._tax_rate = tax_rate;
	}
	public price(): number {
		if (this._amount < 0) { return 0; }
		return this._amount;
	}
	public price_with_tax(): number {
		const tax_amount = this._amount * this._tax_rate;
		return this._amount + tax_amount;
	}
	public summary(): string {
		const base_price = this.price();
		const taxed_price = this.price_with_tax();
		return `${this._item_label}: ${base_price} / ${taxed_price}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { PriceQuote } from "src/price_quote";
(function () {
	const quote = new PriceQuote("Notebook", 12, 0.08);
	quote.report();
})();
```
