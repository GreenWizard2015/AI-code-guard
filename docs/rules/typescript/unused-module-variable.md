# `unused-module-variable`

Description: Reports a module-level variable with no production symbol usage. Move owned state
behind an explicit owner or remove the unused variable.

## Bad

```ts
// File: src/request_ledger.ts
let request_count = 0; // <- error

/** Responsibilities: _request count reporting_. **/
export class RequestLedger {
	private readonly recorded_count: number;
	/** Responsibilities: _ledger initialization_. **/
	public constructor(recorded_count: number) {
		this.recorded_count = recorded_count;
	}
	/** Responsibilities: _request count access_. **/
	public count(): number {
		return this.recorded_count;
	}
	/** Responsibilities: _request summary formatting_. **/
	public summary(): string {
		return `Recorded requests: ${this.count()}`;
	}
	/** Responsibilities: _request report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { RequestLedger } from "src/request_ledger";

(() => {
	const ledger = new RequestLedger(3);
	ledger.report();
})();
```


## Good

```ts
// File: src/request_ledger.ts
/** Responsibilities: _request count reporting_. **/
export class RequestLedger {
	private readonly _recorded_count: number;
	/** Responsibilities: _ledger initialization_. **/
	public constructor(recorded_count: number) {
		this._recorded_count = recorded_count;
	}
	/** Responsibilities: _request count access_. **/
	public count(): number {
		return this._recorded_count;
	}
	/** Responsibilities: _ledger activity classification_. **/
	public populated(): boolean {
		return this._recorded_count > 0;
	}
	/** Responsibilities: _remaining request capacity_. **/
	public remaining_slots(capacity: number): number {
		const available_slots = capacity - this._recorded_count;
		if (available_slots < 0) {
			return 0;
		}
		return available_slots;
	}
	/** Responsibilities: _request summary formatting_. **/
	public summary(): string {
		const count = this.count();
		const active = this.populated();
		const remaining = this.remaining_slots(10);
		return `Recorded requests: ${count} (active=${active}, available=${remaining})`;
	}
	/** Responsibilities: _request report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { RequestLedger } from "src/request_ledger";

(() => {
	const ledger = new RequestLedger(3);
	ledger.report();
})();
```

