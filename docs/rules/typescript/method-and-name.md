# `method-and-name`

Description: Review public method names containing `_and_` or `And`. They often combine two
responsibilities: `saveAndReturn()`, `validateAndSave()`, or `findAndDelete()`.
Split the contracts unless the combined operation must be atomic. Builders
should not have side effects; manipulators should normally return `void`/`None`.

## Bad

```ts
class PriceLabels {
	public save_and_return(): string { return "value"; }
}
```


## Good

```ts
// File: src/price_labels.ts
/** Responsibilities: _status label mapping_. **/
export class PriceLabels {
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
import { PriceLabels } from "src/price_labels";

(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const price_labels = new PriceLabels(labels, "Unknown");
	const label = price_labels.label("ready");
	const detailed = price_labels.label_with_prefix("State", "blocked");
	const fallback = price_labels.uppercase_fallback();
	const count = price_labels.status_count();
	console.log(`${label} ${detailed} ${fallback} ${count}`);
})();
```
