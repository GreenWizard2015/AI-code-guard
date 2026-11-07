# functions-file-type-declaration

Description: Root `functions.ts` and `functions.py` files must not declare classes, standalone types, aliases, interfaces, enums, or structural type values. Free functions are reported by `functions-file-domain-class` and must move with their state into a focused domain class module.

Move each type description to its owning type module or class. Keep the functions file focused on the small callable boundary; do not hide a type declaration in a namespace, nested scope, alias, or wrapper.

## Bad

```ts
// File: functions.ts
export type ServiceState = "ready" | "blocked";
// File: src/status_reporter.ts
export class StatusReporter {
	private readonly state: string;

	public constructor(state: string) {
		this.state = state.trim();
	}

	public normalized_state(): string {
		return this.state.toLowerCase();
	}

	public status_label(): string {
		return `Service ${this.normalized_state()}`;
	}

	public report(): void {
		console.log(this.status_label());
	}
}
// File: cli.ts
import { StatusReporter } from "src/status_reporter";
(function () {
	const reporter = new StatusReporter("ready");
	reporter.report();
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

	/** Responsibilities: _status report summary_. **/
	public summary(): string {
		const labels = [
			this.label("ready"),
			this.label_with_prefix("State", "blocked"),
			this.uppercase_fallback(),
			String(this.status_count()),
		];
		return labels.join(" | ");
	}

	/** Responsibilities: _status report output_. **/
	public report(): void {
		console.log(this.summary());
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
