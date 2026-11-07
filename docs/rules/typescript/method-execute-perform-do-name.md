# `method-execute-perform-do-name`

Description: Review public commands beginning with `execute*`, `perform*`, or `do*`. These
technical verbs carry little domain meaning. Replace `performValidation()` or
`doUpdate()` with the concrete domain action. Generic command infrastructure
may keep the technical name when it is the actual contract.

## Bad

```ts
// File: src/payment_processor.ts
export class PaymentProcessor {
	private readonly payment_reference: string;
	public constructor(payment_reference: string) { this.payment_reference = payment_reference; }
	public execute_payment(): string { return `Payment ${this.payment_reference} accepted`; } // <- error
	public report(): void {
		const result = this.execute_payment();
		console.log(result);
	}
}
// File: cli.ts
import { PaymentProcessor } from "src/payment_processor";
(function () {
	const processor = new PaymentProcessor("PAY-42");
	processor.report();
})();
```


## Good

```ts
// File: src/price_labels.ts
/** Responsibilities: _status label mapping_. **/
export class PriceLabels {
	private readonly _labels: ReadonlyMap<string, string>;
	private readonly _fallback: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this._labels = labels;
		this._fallback = fallback;
	}

	/** Responsibilities: _status label selection_. **/
	public label(status: string): string {
		const label = this._labels.get(status);
		if (label === undefined) {
			return this._fallback;
		}
		return label;
	}

	/** Responsibilities: _prefixed label composition_. **/
	public label_with_prefix(prefix: string, status: string): string {
		const label = this.label(status);
		return `${prefix}: ${label}`;
	}

	/** Responsibilities: _fallback capitalization_. **/
	public uppercase_fallback(): string {
		const normalized = this._fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _mapping size reporting_. **/
	public status_count(): number {
		let count = 0;
		for (const status_name of this._labels.keys()) {
			if (status_name.length > 0) {
				count += 1;
			}
		}
		return count;
	}
	public report(): void {
		const label = this.label("ready");
		const detailed = this.label_with_prefix("State", "blocked");
		const fallback = this.uppercase_fallback();
		const count = this.status_count();
		console.log(`${label} ${detailed} ${fallback} ${count}`);
	}
}
// File: cli.ts
import { PriceLabels } from "src/price_labels";

(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const price_labels = new PriceLabels(labels, "Unknown");
	price_labels.report();
})();
```
