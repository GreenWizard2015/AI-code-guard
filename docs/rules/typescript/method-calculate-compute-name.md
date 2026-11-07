# `method-calculate-compute-name`

Description: Review public non-boolean result methods beginning with `calculate*` or
`compute*`. Name the result rather than the procedure: `calculatePrice()` →
`price()`, `computeHash()` → `hash()`, and `computeDistance()` → `distance()`.

## Bad

```ts
// File: src/invoice_total.ts
export class InvoiceTotal {
	private readonly unit_price: number;
	private readonly quantity: number;
	private readonly tax_rate: number;
	public constructor(unit_price: number, quantity: number, tax_rate: number) {
		this.unit_price = unit_price;
		this.quantity = quantity;
		this.tax_rate = tax_rate;
	}
	public subtotal(): number { return this.unit_price * this.quantity; }
	public tax_amount(): number { return this.subtotal() * this.tax_rate; }
	public calculate_total(): number { // <- error
		const base_amount = this.subtotal();
		const tax_amount = this.tax_amount();
		return base_amount + tax_amount;
	}
	public summary(): string {
		return `Subtotal ${this.subtotal().toFixed(2)}, total ${this.calculate_total().toFixed(2)}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { InvoiceTotal } from "src/invoice_total";
(function () {
	const invoice = new InvoiceTotal(18.5, 2, 0.08);
	invoice.report();
})();
```

## Good

```ts
// File: src/invoice_total.ts
export class InvoiceTotal {
	private readonly _unit_price: number;
	private readonly _quantity: number;
	private readonly _tax_rate: number;
	public constructor(unit_price: number, quantity: number, tax_rate: number) {
		this._unit_price = unit_price;
		this._quantity = quantity;
		this._tax_rate = tax_rate;
	}
	public subtotal(): number {
		if (this._quantity < 0) { return 0; }
		return this._unit_price * this._quantity;
	}
	public tax_amount(): number { return this.subtotal() * this._tax_rate; }
	public total(): number {
		const base_amount = this.subtotal();
		const tax_amount = this.tax_amount();
		return base_amount + tax_amount;
	}
	public summary(): string {
		return `Subtotal ${this.subtotal().toFixed(2)}, total ${this.total().toFixed(2)}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { InvoiceTotal } from "src/invoice_total";
(function () {
	const invoice = new InvoiceTotal(18.5, 2, 0.08);
	invoice.report();
})();
```
