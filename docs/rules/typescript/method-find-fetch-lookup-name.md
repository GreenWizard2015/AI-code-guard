# `method-find-fetch-lookup-name`

Description: Review public non-boolean result methods beginning with `find*`, `fetch*`, or
`lookup*`. These names expose how a result is obtained rather than the result
itself. Prefer `book(title)` over `find(title)`: the implementation remains
free to use a cache, construct the value, or retrieve it remotely.

## Bad

```ts
// File: src/receipt_book.ts
export class ReceiptBook {
	private readonly receipt_id: string;
	private readonly item_count: number;
	private readonly amount: number;
	public constructor(receipt_id: string, item_count: number, amount: number) {
		this.receipt_id = receipt_id;
		this.item_count = item_count;
		this.amount = amount;
	}
	public find_receipt(): string { return `${this.receipt_id}: ${this.amount}`; } // <- error
	public item_summary(): string { return `${this.item_count} items`; }
	public total_label(): string { return `Total ${this.amount.toFixed(2)}`; }
	public summary(): string {
		const receipt = this.find_receipt();
		const items = this.item_summary();
		return `${receipt} | ${items} | ${this.total_label()}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { ReceiptBook } from "src/receipt_book";
(function () {
	const receipt = new ReceiptBook("R-17", 3, 24.5);
	receipt.report();
})();
```

## Good

```ts
// File: src/receipt_book.ts
export class ReceiptBook {
	private readonly _receipt_id: string;
	private readonly _item_count: number;
	private readonly _amount: number;
	public constructor(receipt_id: string, item_count: number, amount: number) {
		this._receipt_id = receipt_id;
		this._item_count = item_count;
		this._amount = amount;
	}
	public receipt(): string {
		if (this._receipt_id.trim().length === 0) { return ""; }
		return `${this._receipt_id}: ${this._amount}`;
	}
	public item_summary(): string { return `${this._item_count} items`; }
	public total_label(): string { return `Total ${this._amount.toFixed(2)}`; }
	public summary(): string {
		const receipt = this.receipt();
		const items = this.item_summary();
		return `${receipt} | ${items} | ${this.total_label()}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { ReceiptBook } from "src/receipt_book";
(function () {
	const receipt = new ReceiptBook("R-17", 3, 24.5);
	receipt.report();
})();
```
