# `constructor-dependency-count`

Description: Detect constructors that create too many different project-owned collaborators.

Split the class or group dependencies behind one focused collaborator.

## Bad

```ts
{% const dependencies = [{"module":"account_store","name":"AccountStore","field":"account_store","value":"accounts"},{"module":"billing_ledger","name":"BillingLedger","field":"billing_ledger","value":"billing"},{"module":"catalog_index","name":"CatalogIndex","field":"catalog_index","value":"catalog"},{"module":"system_clock","name":"SystemClock","field":"system_clock","value":"clock"},{"module":"mail_gateway","name":"MailGateway","field":"mail_gateway","value":"mail"},{"module":"stock_ledger","name":"StockLedger","field":"stock_ledger","value":"stock"}] %}
{%for dependency in dependencies %}
// File: src/{{dependency.module}}.ts
export class {{dependency.name}} {
	private readonly values: readonly string[];
	public constructor(values: readonly string[]) { this.values = values; }
	public normalized_entries(): readonly string[] {
		const entries: string[] = [];
		for (const value of this.values) {
			const normalized = value.trim();
			if (normalized.length > 0) { entries.push(normalized); }
		}
			return entries.sort();
	}
	public nonempty_count(): number {
		let count = 0;
		for (const value of this.values) {
			if (value.length > 0) { count += 1; }
		}
		return count;
	}
}
{% endfor %}
// File: src/checkout_application.ts
{%for dependency in dependencies %}
import { {{dependency.name}} } from "src/{{dependency.module}}";
{% endfor %}
export class CheckoutApplication {
{%for dependency in dependencies %}
	private readonly {{dependency.field}} = new {{dependency.name}}(["{{dependency.value}}"]);
{% endfor %}
	public run(): string {
		return [
{%for dependency in dependencies %}
			this.{{dependency.field}}.normalized_entries().join(":"),
{% endfor %}
		].join(",");
	}
	public ready(): boolean {
		const states = [
{%for dependency in dependencies %}
			this.{{dependency.field}}.nonempty_count() === 0,
{% endfor %}
		];
		return !states.includes(true);
	}
	public dependency_count(): number {
		return [
{%for dependency in dependencies %}
			this.{{dependency.field}}.nonempty_count(),
{% endfor %}
		].reduce((total, count) => total + count, 0);
	}
	public report(): void { console.log(this.run(), this.ready(), this.dependency_count()); }
}
// File: cli.ts
import { CheckoutApplication } from "src/checkout_application";
(function () {
	const application = new CheckoutApplication();
	application.report();
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
		if (label === undefined) { return this._fallback; }
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
			if (status_name.length > 0) { count += 1; }
		}
		return count;
	}
	public report(): void { console.log(this.uppercase_fallback(), this.status_count()); }
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map([["ready", "Ready"], ["blocked", "Blocked"]]);
	const status_labels = new StatusLabels(labels, "Unknown");
	const label = status_labels.label("ready");
	const detailed = status_labels.label_with_prefix("State", "blocked");
	status_labels.report();
void label;
void detailed;
})();
```
