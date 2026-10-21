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
{% for index in range(600) %}
	// More accumulated parsing, selection, and invoice behavior.
{% endfor %}
// File: cli.ts
import { Orders } from "src/orders";
(function () {
	const orders = new Orders("ORD-42,18.50,paid");
	const rows = orders.rows();
	const paid_rows = orders.paid_rows();
	const total = orders.invoice_total();
	console.log(rows, paid_rows, total);
})();
```

## Good

Separate row ownership and invoice calculations:

```ts
// File: src/order_ledger.ts
export class OrderLedger {
	private readonly text: string;
	public constructor(text: string) { this.text = text; }
	public rows(): string[] { return this.text.split("\n").map((row) => row.trim()).filter((row) => row.length > 0); }
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
export class OrderInvoice {
	private readonly rows_value: readonly string[];
	public constructor(rows: readonly string[]) { this.rows_value = rows; }
	public total(): number {
		let total = 0;
		for (const row of this.rows_value) {
			const fields = row.split(",");
			total += Number(fields[1]);
		}
		return total;
	}
	public count(): number { return this.rows_value.filter((row) => row.length > 0).length; }
	public average(): number {
		const count = this.count();
		if (count === 0) { return 0; }
		return this.total() / count;
	}
}
// File: cli.ts
import { OrderInvoice } from "src/order_invoice";
import { OrderLedger } from "src/order_ledger";
(function () {
	const ledger = new OrderLedger("ORD-42,18.50,paid");
	const rows = ledger.rows();
	const row_count = ledger.count();
	const paid_rows = ledger.paid_rows();
	const paid_count = ledger.paid_count();
	const contains_order = ledger.contains_order("ORD-42");
	const invoice = new OrderInvoice(rows);
	const total = invoice.total();
	const count = invoice.count();
	const average = invoice.average();
	console.log(rows, row_count, paid_rows, paid_count, contains_order, total, count, average);
})();
```
