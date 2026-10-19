# `cli-file-function-count`

Description: Each `cli.*` module may contain at most one free function: its entry point. All other behavior belongs in focused domain classes. Class methods, nested functions, and an inline startup wrapper are not counted as additional free entry points.

Problem: `cli.*` contains more than one free function.

Hint: Keep one free entry-point function in `cli.*` and move every other operation into focused domain classes.

## Bad

```ts
// File: cli.ts
function start(): void {}
function load_configuration(): void {}
function report_status(): void {}
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
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const status_labels = new StatusLabels(labels, "Unknown");
	const label = status_labels.label("ready");
	const detailed = status_labels.label_with_prefix("State", "blocked");
	const fallback = status_labels.uppercase_fallback();
	const count = status_labels.status_count();
	console.log(`${label} ${detailed} ${fallback} ${count}`);
})();
```
