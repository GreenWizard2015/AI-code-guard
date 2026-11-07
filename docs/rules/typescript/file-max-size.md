# `file-max-size`

Description: Detect source files that exceed the maintainable line count. Blank lines and comments count. Split only at real ownership boundaries.

## Bad

One growing module mixes row parsing, selection, and invoice calculations; repeated comments represent its accumulated code:

```ts
// File: src/orders.ts
export class Orders {
	private readonly text: string;
	public constructor(text: string) { this.text = text; }
	public rows(): string[] { return this.text.split("\n").map((row) => row.trim()).filter((row) => row.length > 0); }
	public paid_rows(): string[] { return this.rows().filter((row) => row.endsWith(",paid")); }
	public invoice_total(): number {
		let total = 0;
		for (const row of this.rows()) {
			const fields = row.split(",");
			total += Number(fields[1]);
		}
		return total;
	}
	public report(): void {
		console.log(this.rows(), this.paid_rows(), this.invoice_total());
	}
{% for index in range(600) %}
	// More accumulated parsing, selection, and invoice behavior.
{% endfor %}
// File: cli.ts
import { Orders } from "src/orders";
(function () {
	const orders = new Orders("ORD-42,18.50,paid");
	orders.report();
})();
```

## Good

Separate row ownership and invoice calculations:

```ts
// File: src/protocols.ts
export interface OrderLedgerContract {
	rows(): string[];
	count(): number;
	paid_rows(): string[];
	paid_count(): number;
	contains_order(order_id: string): boolean;
}
// File: src/order_ledger.ts
import { OrderLedgerContract } from "src/protocols";
export class OrderLedger implements OrderLedgerContract {
	private readonly _text: string;
	public constructor(text: string) { this._text = text; }
	public rows(): string[] { return this._text.split("\n").map((row) => row.trim()).filter((row) => row.length > 0); }
	public count(): number { return this.rows().length; }
	public paid_rows(): string[] { return this.rows().filter((row) => row.endsWith(",paid")); }
	public paid_count(): number { return this.paid_rows().length; }
	public contains_order(order_id: string): boolean {
		for (const row of this.rows()) {
			const fields = row.split(",");
			if (fields[0] === order_id) { return true; }
		}
		return false;
	}
}
// File: src/order_invoice.ts
import { OrderLedgerContract } from "src/protocols";
export class OrderInvoice {
	private readonly _ledger: OrderLedgerContract;
	public constructor(source: OrderLedgerContract) { this._ledger = source; }
	public total(): number {
		let total = 0;
		for (const row of this._ledger.rows()) {
			const fields = row.split(",");
			total += Number(fields[1]);
		}
		return total;
	}
	public average(): number {
		const count = this._ledger.count();
		if (count === 0) { return 0; }
		return this.total() / count;
	}
	public report(): void {
		const row_count = this._ledger.count();
		const paid_rows = this._ledger.paid_rows();
		const paid_count = this._ledger.paid_count();
		const contains_order = this._ledger.contains_order("ORD-42");
		const total = this.total();
		const count = this._ledger.count();
		const average = this.average();
		console.log(row_count, paid_rows, paid_count, contains_order, total, count, average);
	}
}
// File: cli.ts
import { OrderInvoice } from "src/order_invoice";
import { OrderLedger } from "src/order_ledger";
(function () {
	const ledger = new OrderLedger("ORD-42,18.50,paid");
	const invoice = new OrderInvoice(ledger);
	invoice.report();
})();
```
