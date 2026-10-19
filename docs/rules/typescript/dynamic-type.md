# `dynamic-type`

Description: Runtime-built project classes hide their field and behavior contracts. Declare
normal domain classes with explicit state and operations instead.

## Bad

```ts
// File: cli.ts
(function () {
	const class_factory = type;
	const runtime_model = class_factory("RuntimeModel", {}, {});
	console.log(runtime_model);
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
	const labels = new Map<string, string>([["ready", "Ready"]]);
	const owner = new StatusLabels(labels, "Unknown");
	console.log(owner.label("ready"));
	console.log(owner.label_with_prefix("State", "ready"));
	console.log(owner.uppercase_fallback());
	console.log(owner.status_count());
})();
```
