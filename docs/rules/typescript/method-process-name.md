# `method-process-name`

Description: Review public commands beginning with `process*`. The name often hides several
actions: `processPayment()` may validate, authorize, charge, store, and notify.
Replace it with the concrete domain action or split the responsibilities.
`process` may remain at a genuine generic processing boundary.

## Bad

```ts
// File: src/payment.ts
export class Payment {
	private readonly account_id: string;
	private readonly amount: number;

	private approval_status(): string {
		if (this.amount > 0) {
			return "approved";
		}
		return "review";
	}

	private charge_line(): string {
		return `${this.account_id}: ${this.amount.toFixed(2)}`;
	}

	public constructor(account_id: string, amount: number) {
		this.account_id = account_id;
		this.amount = amount;
	}

	public process_payment(): string {
		const approval = this.approval_status();
		const charge = this.charge_line();
		return `${approval}: ${charge}`;
	}

	public report(): void {
		const receipt = this.process_payment();
		console.log(receipt);
	}
}
// File: cli.ts
import { Payment } from "src/payment";

(function run(): void {
	const payment = new Payment("account-1", 25.5);
	payment.report();
})();
```


## Good

```ts
// File: src/payment.ts
/** Responsibilities: _payment authorization_, _account charging_, _receipt reporting_. **/
export class Payment {
	private readonly _account_id: string;
	private readonly _amount: number;

	/** Responsibilities: _payment initialization_. **/
	public constructor(account_id: string, amount: number) {
		this._account_id = account_id;
		this._amount = amount;
	}

	/** Responsibilities: _payment approval status_. **/
	public approval_status(): string {
		if (this._amount > 0) {
			return "approved";
		}
		return "review";
	}

	/** Responsibilities: _account charge description_. **/
	public charge_account(): string {
		const account = this._account_id.trim();
		const amount = this._amount.toFixed(2);
		return `${account}: ${amount}`;
	}

	/** Responsibilities: _payment receipt_. **/
	public receipt(): string {
		const approval = this.approval_status();
		const charge = this.charge_account();
		return `${approval}: ${charge}`;
	}

	/** Responsibilities: _receipt output_. **/
	public report(): void {
		const receipt = this.receipt();
		console.log(receipt);
	}
}
// File: cli.ts
import { Payment } from "src/payment";

(function run(): void {
	const payment = new Payment("account-1", 25.5);
	payment.report();
})();
```
