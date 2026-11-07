# `cli-file-function-count`

Description: Each `cli.*` module may contain at most one free function: its entry point. All other behavior belongs in focused domain classes. Class methods, nested functions, and an inline startup wrapper are not counted as additional free entry points.

Problem: `cli.*` contains more than one free function.

Hint: Keep one free entry-point function in `cli.*` and move every other operation into focused domain classes.

## Bad

```ts
// File: src/status_labels.ts
export class StatusLabels {
	public report(requested_status: string): void { console.log(requested_status); }
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
function start(): void { new StatusLabels().report("ready"); }
function load_configuration(): void { new StatusLabels().report("blocked"); }
function report_status(): void { new StatusLabels().report("missing"); }
start();
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
	/** Responsibilities: _status label reporting_. **/
	public report(requested_status: string): void { console.log(this.label(requested_status)); }
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
	status_labels.report(`${label} ${detailed} ${fallback} ${count}`);
})();
```
