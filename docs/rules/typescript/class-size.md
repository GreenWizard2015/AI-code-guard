# `class-size`

Description: Classes whose combined body-size metric is outside the configured range indicate weak
ownership.

```ts
class Everything {
  private readonly responsibility = 'unrelated operations';
}
```

### Fix

Split the class by cohesive capabilities without adding placeholder methods or hiding the original class behind wrappers.

## Bad

```ts
{% const status_methods = [{"name":"member","visibility":"public","prefix":""},{"name":"group","visibility":"public","prefix":""},{"name":"page","visibility":"public","prefix":""},{"name":"post","visibility":"public","prefix":""},{"name":"photo","visibility":"public","prefix":""},{"name":"video","visibility":"public","prefix":""},{"name":"event","visibility":"public","prefix":""},{"name":"comment","visibility":"public","prefix":""},{"name":"reaction","visibility":"private","prefix":"_"},{"name":"message","visibility":"private","prefix":"_"},{"name":"thread","visibility":"private","prefix":"_"},{"name":"story","visibility":"private","prefix":"_"},{"name":"album","visibility":"private","prefix":"_"},{"name":"notification","visibility":"private","prefix":"_"},{"name":"attachment","visibility":"private","prefix":"_"},{"name":"contact","visibility":"private","prefix":"_"},{"name":"search","visibility":"public","prefix":""},{"name":"billing","visibility":"public","prefix":""},{"name":"audit","visibility":"public","prefix":""},{"name":"access","visibility":"public","prefix":""},{"name":"settings","visibility":"public","prefix":""},{"name":"export","visibility":"public","prefix":""}] %}
// File: src/status_labels.ts
export class StatusLabels {
{%for method in status_methods %}
	{{method.visibility}} {{method.prefix}}{{method.name}}_status(): string { return "{{method.name}}"; }
{% endfor %}
	public report(): void {
		const statuses = [
{%for method in status_methods %}
			this.{{method.prefix}}{{method.name}}_status(),
{% endfor %}
		];
		console.log(statuses.join(" | "));
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const status_labels = new StatusLabels();
	status_labels.report();
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

(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const status_labels = new StatusLabels(labels, "Unknown");
	status_labels.report();
})();
```
