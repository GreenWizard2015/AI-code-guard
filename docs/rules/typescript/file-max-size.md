# `file-max-size`

Description: Detect a source file whose raw line count has grown beyond a maintainable size. Comments and blank lines count. The diagnostic measures physical file size, not responsibility; split only along real ownership boundaries.

## Bad

One accumulated file owns source parsing, order selection, and invoice calculations (representative excerpt):

```ts
// File: src/order_workflow.ts
export class OrderWorkflow {
	private readonly text: string;
	public constructor(text: string) { this.text = text; }
	public rows(): string[] {
		const rows: string[] = [];
		for (const row of this.text.split("\n")) { if (row.trim().length > 0) { rows.push(row.trim()); } }
		return rows;
	}
	public row_count(): number {
		let count = 0;
		for (const row of this.text.split("\n")) { if (row.trim().length > 0) { count += 1; } }
		return count;
	}
	public empty(): boolean { return this.text.trim().length === 0; }
	public paid_rows(): string[] { return this.rows().filter((row) => row.endsWith(",paid")); }
	public unpaid_rows(): string[] { return this.rows().filter((row) => !row.endsWith(",paid")); }
	public paid_count(): number {
		let count = 0;
		for (const row of this.rows()) { if (row.endsWith(",paid")) { count += 1; } }
		return count;
	}
	public contains_order(order_id: string): boolean {
		for (const row of this.rows()) { const fields = row.split(","); if (fields[0] === order_id) { return true; } }
		return false;
	}
	public invoice_total(): number {
		let total = 0;
		for (const row of this.rows()) { const fields = row.split(","); total += Number(fields[1]); }
		return total;
	}
	public invoice_count(): number { return this.row_count(); }
	public average_invoice(): number {
		const count = this.invoice_count();
		if (count === 0) { return 0; }
		return this.invoice_total() / count;
	}
}
// File: cli.ts
import { OrderWorkflow } from "src/order_workflow";
(function () {
	const workflow = new OrderWorkflow("ORD-42,18.50,paid");
	const rows = workflow.rows();
	const row_count = workflow.row_count();
	const empty = workflow.empty();
	const paid = workflow.paid_rows();
	const unpaid = workflow.unpaid_rows();
	const paid_count = workflow.paid_count();
	const contains_order = workflow.contains_order("ORD-42");
	const total = workflow.invoice_total();
	const invoice_count = workflow.invoice_count();
	const average = workflow.average_invoice();
	process.stdout.write(JSON.stringify([rows, row_count, empty, paid, unpaid, paid_count, contains_order, total, invoice_count, average]));
})();
```

## Good

Keep the same behavior, with state and operations owned by focused modules:

```ts
// File: src/order_source.ts
export class OrderSource {
	private readonly text: string;
	public constructor(text: string) { this.text = text; }
	public rows(): string[] {
		const rows: string[] = [];
		for (const row of this.text.split("\n")) { if (row.trim().length > 0) { rows.push(row.trim()); } }
		return rows;
	}
	public row_count(): number {
		let count = 0;
		for (const row of this.text.split("\n")) { if (row.trim().length > 0) { count += 1; } }
		return count;
	}
	public empty(): boolean { return this.text.trim().length === 0; }
}
// File: src/paid_order_selection.ts
export class PaidOrderSelection {
	private readonly rows_value: readonly string[];
	public constructor(rows: readonly string[]) { this.rows_value = rows; }
	public paid_rows(): string[] { return this.rows_value.filter((row) => row.endsWith(",paid")); }
	public unpaid_rows(): string[] { return this.rows_value.filter((row) => !row.endsWith(",paid")); }
	public paid_count(): number {
		let count = 0;
		for (const row of this.rows_value) { if (row.endsWith(",paid")) { count += 1; } }
		return count;
	}
	public contains_order(order_id: string): boolean {
		for (const row of this.rows_value) { const fields = row.split(","); if (fields[0] === order_id) { return true; } }
		return false;
	}
}
// File: src/order_invoice.ts
export class OrderInvoice {
	private readonly rows_value: readonly string[];
	public constructor(rows: readonly string[]) { this.rows_value = rows; }
	public invoice_total(): number {
		let total = 0;
		for (const row of this.rows_value) { const fields = row.split(","); total += Number(fields[1]); }
		return total;
	}
	public invoice_count(): number {
		let count = 0;
		for (const row of this.rows_value) { if (row.length > 0) { count += 1; } }
		return count;
	}
	public average_invoice(): number {
		const count = this.invoice_count();
		if (count === 0) { return 0; }
		return this.invoice_total() / count;
	}
}
// File: cli.ts
import { OrderInvoice } from "src/order_invoice";
import { OrderSource } from "src/order_source";
import { PaidOrderSelection } from "src/paid_order_selection";
(function () {
	const source = new OrderSource("ORD-42,18.50,paid");
	const rows = source.rows();
	const row_count = source.row_count();
	const empty = source.empty();
	const selection = new PaidOrderSelection(rows);
	const paid = selection.paid_rows();
	const unpaid = selection.unpaid_rows();
	const paid_count = selection.paid_count();
	const contains_order = selection.contains_order("ORD-42");
	const invoice = new OrderInvoice(rows);
	const total = invoice.invoice_total();
	const invoice_count = invoice.invoice_count();
	const average = invoice.average_invoice();
	process.stdout.write(JSON.stringify([rows, row_count, empty, paid, unpaid, paid_count, contains_order, total, invoice_count, average]));
})();
```
