# `branch-duplication`

Description: Avoid an `if`/`elif` chain that compares the same identifier against several
values and repeats the same kind of branch. Use a lookup keyed by that value
when it expresses the mapping directly.

## Bad

The class examples below isolate the repeated branch in a real caller and show the same mapping
before and after replacing it with a lookup.

```ts
// File: src/status_labels.ts
export class StatusLabels {
	private readonly fallback: string;

	public constructor(fallback: string) {
		this.fallback = fallback;
	}

	public label(status: string): string {
		if (status === "ready") { // <- error
			return "Ready";
		} else if (status === "blocked") {
			return "Blocked";
		} else if (status === "complete") {
			return "Complete";
		}
		return this.fallback;
	}

	public label_with_prefix(prefix: string, status: string): string {
		const label = this.label(status);
		return `${prefix}: ${label}`;
	}

	public uppercase_fallback(): string {
		const normalized = this.fallback.trim();
		return normalized.toUpperCase();
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new StatusLabels("Unknown");
	const label = labels.label("ready");
	const detailed = labels.label_with_prefix("State", "blocked");
	console.log(label, detailed, labels.uppercase_fallback());
})();
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

	/** Responsibilities: _fallback label access_. **/
	public uppercase_fallback(): string {
		const normalized = this.fallback.trim();
		return normalized.toUpperCase();
	}

}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map([["ready", "Ready"], ["blocked", "Blocked"], ["complete", "Complete"]]);
	const status_labels = new StatusLabels(labels, "Unknown");
	const label = status_labels.label("ready");
	const detailed = status_labels.label_with_prefix("State", "blocked");
	console.log(label, detailed, status_labels.uppercase_fallback());
})();
```

