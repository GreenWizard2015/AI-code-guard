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

	public report(): void {
		const loaded_document = this.document;
		console.log(loaded_document);
	}
}
// File: cli.ts
import { DocumentLoader } from "src/document_loader";

(function run(): void {
	const loader = new DocumentLoader(" ready document ");
	loader.report();
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

	/** Responsibilities: _status overview reporting_. **/
	public report(): void {
		const ready = this.label("ready");
		const blocked = this.label_with_prefix("State", "blocked");
		const fallback = this.uppercase_fallback();
		const count = this.status_count();
		console.log(`${ready}; ${blocked}; ${fallback}; ${count} statuses`);
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";

(function run(): void {
	const labels = new Map<string, string>([["ready", "Ready"], ["blocked", "Blocked"]]);
	const status_labels = new StatusLabels(labels, "Unknown");
	status_labels.report();
})();
```
