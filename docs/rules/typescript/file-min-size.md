# `file-min-size`

Description: Detect a source file with very little implementation code. A tiny forwarding module can indicate misplaced behavior; this size check does not decide whether a small domain type is meaningful.

## Bad

This module only forwards behavior already owned by `Order`:

```ts
// File: src/order_label.ts
import { Order } from "src/order";
export class OrderLabel {
	public format(order: Order): string { return order.display_label(); }
}
// File: src/order.ts
export class Order {
	private readonly code: string;
	private readonly status: string;
	private readonly items: string[];
	public constructor(code: string, status: string) {
		const normalized_code = code.trim().toUpperCase();
		if (normalized_code.length === 0) { throw new Error("Order code is required."); }
		this.code = normalized_code;
		if (status.length === 0) { throw new Error("Order status is required."); }
		this.status = status;
		this.items = [];
	}
	public display_label(): string { return `Order ${this.code}`; }
	public paid(): boolean { return this.status === "paid"; }
	public add_item(item: string): void {
		const normalized = item.trim();
		if (normalized.length > 0) { this.items.push(normalized); }
	}
	public item_summary(): string { return this.items.join(", "); }
}
// File: cli.ts
import { OrderLabel } from "src/order_label";
import { Order } from "src/order";
(function () {
	const order = new Order("ord-42", "paid");
	const label = new OrderLabel().format(order);
	const paid = order.paid();
	order.add_item("book");
	const item_summary = order.item_summary();
	process.stdout.write(JSON.stringify([label, paid, item_summary]));
})();
```

## Good

Use the existing owner directly and remove the forwarding module:

```ts
// File: src/order.ts
export class Order {
	private readonly code: string;
	private readonly status: string;
	private readonly items: string[];
	public constructor(code: string, status: string) {
		const normalized_code = code.trim().toUpperCase();
		if (normalized_code.length === 0) { throw new Error("Order code is required."); }
		this.code = normalized_code;
		if (status.length === 0) { throw new Error("Order status is required."); }
		this.status = status;
		this.items = [];
	}
	public display_label(): string { return `Order ${this.code}`; }
	public paid(): boolean { return this.status === "paid"; }
	public add_item(item: string): void {
		const normalized = item.trim();
		if (normalized.length > 0) { this.items.push(normalized); }
	}
	public item_summary(): string { return this.items.join(", "); }
}
// File: cli.ts
import { Order } from "src/order";
(function () {
	const order = new Order("ord-42", "paid");
	const label = order.display_label();
	const paid = order.paid();
	order.add_item("book");
	const item_summary = order.item_summary();
	process.stdout.write(JSON.stringify([label, paid, item_summary]));
})();
```
