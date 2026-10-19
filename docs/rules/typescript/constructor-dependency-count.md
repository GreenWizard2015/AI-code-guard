# constructor-dependency-count

Description: Reports a class whose resolved composition graph contains more than five
different project-owned class dependencies initialized as part of its object
construction.

The rule counts resolved project classes only. Collections, regular
expressions, built-ins, external packages, and unresolved names are
not counted. The same dependency used more than once counts once.

Split the class or introduce a focused collaborator that owns one cohesive
dependency group. This is a composition rule, not a raw count of every `new`
expression in a constructor.

## Bad

```ts
{% const dependencies = [{"module":"account_store","name":"AccountStore","field":"account_store"},{"module":"billing_ledger","name":"BillingLedger","field":"billing_ledger"},{"module":"catalog_index","name":"CatalogIndex","field":"catalog_index"},{"module":"system_clock","name":"SystemClock","field":"system_clock"},{"module":"mail_gateway","name":"MailGateway","field":"mail_gateway"},{"module":"stock_ledger","name":"StockLedger","field":"stock_ledger"}] %}
// File: src/checkout_application/checkout_application.ts
{%for dependency in dependencies %}
import { {{dependency.name}} } from "src/{{dependency.module}}/{{dependency.module}}";
{% endfor %}

export class CheckoutApplication {
{%for dependency in dependencies %}
	private readonly {{dependency.field}}: {{dependency.name}};
{% endfor %}

	public constructor() {
{%for dependency in dependencies %}
		this.{{dependency.field}} = new {{dependency.name}}();
{% endfor %}
	}

	public run(): string { return "started"; }
}
{%for dependency in dependencies %}
// File: src/{{dependency.module}}/{{dependency.module}}.ts
export class {{dependency.name}} {}
{% endfor %}
```

## Good

```ts
// File: src/status_labels.ts
/** Responsibilities: _status label mapping_. **/
export class StatusLabels {
	private readonly labels: ReadonlyMap<string, string>;
	private readonly fallback: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this.labels = labels;
		this.fallback = fallback;
	}

	/** Responsibilities: _status label selection_. **/
	public label(status: string): string {
		const label = this.labels.get(status);
		if (label === undefined) {
			return this.fallback;
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
		const normalized = this.fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _mapping size reporting_. **/
	public status_count(): number {
		let count = 0;
		for (const status_name of this.labels.keys()) {
			if (status_name.length > 0) {
				count += 1;
			}
		}
		return count;
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map([["ready", "Ready"], ["blocked", "Blocked"]]);
	const status_labels = new StatusLabels(labels, "Unknown");
	const label = status_labels.label("ready");
	const detailed = status_labels.label_with_prefix("State", "blocked");
	console.log(label, detailed, status_labels.uppercase_fallback(), status_labels.status_count());
})();
```
