# `complex-constructor`

Description: Constructors should establish a valid object by assigning ready values and
dependencies. Move I/O, parsing, and calls to the object’s own behavior into a
named operation that can run after construction.

## Bad

```ts
// File: src/document_loader.ts
export class DocumentLoader {
	private readonly source: string;
	private document: string;

	public constructor(source: string) {
		this.source = source;
		this.document = this.parse_source();
	}

	private parse_source(): string {
		return this.source.trim();
	}
}
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
	const labels = new Map<string, string>([["ready", "Ready"], ["blocked", "Blocked"]]);
	const status_labels = new StatusLabels(labels, "Unknown");
	console.log(status_labels.label("ready"));
	console.log(status_labels.label_with_prefix("State", "blocked"));
	console.log(status_labels.uppercase_fallback());
	console.log(status_labels.status_count());
})();
```
