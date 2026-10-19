# `field-in-constructor`

Description: Object fields must be declared separately and initialized in the constructor.
This applies to TypeScript `new` expressions and Python constructor or factory
calls in class fields.

```ts
class ImportResolver {
	private readonly cache = new Map<string, string>();
}
```


Declare the field first, then initialize it in `constructor`, `__init__`, or
`__post_init__`.

## Bad

```ts
class Service { private readonly client = new Client(); }
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
	const owner = new StatusLabels(new Map([["ready", "Ready"]]), "Unknown");
	console.log(owner.label("ready"));
	console.log(owner.label_with_prefix("State", "ready"));
	console.log(owner.uppercase_fallback());
	console.log(owner.status_count());
})();
```
