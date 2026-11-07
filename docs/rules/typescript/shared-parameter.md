# `shared-parameter`

Description: Repeated parameter pairs or bundles can reveal a shared domain contract. Match every annotated parameter by its exact `name:type` pair, regardless of type category; parameter order does not matter. Top-level functions are grouped project-wide and methods within their declaring class. Constructors and test methods are excluded; private methods count.

## Bad

```ts
// File: src/types.ts
export type TransferData = { readonly name: string; };
// File: src/transfer_session.ts
import type { TransferData } from "src/transfer_data";
export class TransferSession {
	private readonly data: TransferData;
	private readonly key: string;
	public constructor(data: TransferData, key: string) { this.data = data; this.key = key; }
	public send_one(data: TransferData, key: string): string { return data.name + key; }
	public send_two(key: string, data: TransferData): string { return data.name + key; } // <- error
	public send_three(data: TransferData, key: string): string { return data.name + key; }
	public send_four(data: TransferData, key: string): string { return data.name + key; }
	public report(): void { console.log(this.send_one(this.data, this.key)); }
}
// File: cli.ts
import { TransferSession } from "src/transfer_session";
import type { TransferData } from "src/transfer_data";
(function () {
	const data: TransferData = { name: "item" };
	const session = new TransferSession(data, "a");
	session.send_one(data, "a");
	session.send_two("b", data);
	session.send_three(data, "c");
	session.send_four(data, "d");
	session.report();
})();
```

The repeated pairs are `data:TransferData` and `key:string`. The second method reverses their positional order, but the set still matches.

## Good

```ts
// File: src/types.ts
export type TransferRequest = { readonly name: string; readonly key: string; };
// File: src/transfer_session.ts
import type { TransferRequest } from "src/types";
export class TransferSession {
	private readonly _request: TransferRequest;
	private readonly _recipient: string;
	public constructor(request: TransferRequest, recipient: string) {
		this._request = request;
		this._recipient = recipient;
	}
	public send(): string {
		const payload = this.payload();
		if (payload.length === 0) { return "incomplete transfer"; }
		return `${payload} ${this.recipient_label()}`;
	}
	public payload(): string {
		const name = this._request.name.trim();
		const key = this._request.key.trim();
		if (name.length === 0 || key.length === 0) { return ""; }
		return `${name}:${key}`;
	}
	public recipient_label(): string { return `to ${this._recipient}`; }
	public receipt(): string {
		const sent_transfer = this.send();
		return `sent ${sent_transfer}`;
	}
	public description(): string {
		const transfer_receipt = this.receipt();
		return `transfer: ${transfer_receipt}`;
	}
	public report(): void {
		console.log(this.description());
	}
}
// File: cli.ts
import { TransferSession } from "src/transfer_session";
import type { TransferRequest } from "src/types";
(function () {
	const request: TransferRequest = { name: "item", key: "a" };
	const session = new TransferSession(request, "warehouse");
	session.report();
})();
```
