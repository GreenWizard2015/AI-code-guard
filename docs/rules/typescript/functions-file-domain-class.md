# `functions-file-domain-class`

Description: The exact root `functions.ts`, `functions.tsx`, or `functions.py` file must not contain free functions. Move each function and its state into a focused domain class in a focused module, then remove the root file when it is empty. Nested functions and class methods are not reported by this rule.

Problem: `functions.*` contains a free function.

Hint: Move the function and its state into a focused domain class in a focused module, then remove the root `functions.*` file when it is empty. Do not hide it behind a forwarding wrapper.

## Bad

```ts
// File: functions.ts
export function resolve_user(user_id: string): string {
	return user_id.trim();
}
export function report_user(user_id: string): void {
	console.log(`User: ${resolve_user(user_id)}`);
}
export function format_invoice(invoice_id: string): string {
	return `Invoice ${invoice_id.trim()}`;
}
export function report_invoice(invoice_id: string): void {
	console.log(format_invoice(invoice_id));
}
// File: cli.ts
import { report_invoice, report_user } from "functions";

(() => {
	report_user("user-7");
	report_invoice("invoice-3");
})();
```


## Good

```ts
// File: src/status_labels.ts
/** Responsibilities: _status label mapping_. **/
export class StatusLabels {
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
	/** Responsibilities: _status summary reporting_. **/
	public report(): void {
		const label = this.label("ready");
		const detailed = this.label_with_prefix("State", "blocked");
		const fallback = this.uppercase_fallback();
		const count = this.status_count();
		console.log(`${label} ${detailed} ${fallback} ${count}`);
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";

(() => {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const status_labels = new StatusLabels(labels, "Unknown");
	status_labels.report();
})();
```
