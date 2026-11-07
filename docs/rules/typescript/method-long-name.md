# `method-long-name`

Description: Review CamelCase method names containing more than six words, such as
`findCurrentUserByEmailAddress()` or
`registerServletContainerInitializerToDriveServletContextInitializers()`.
For Python, `_name` is private and `__name__` is a magic method; neither is
counted as an ordinary method name.
The name may be compensating for an oversized class scope. Inspect the class
boundary and decompose responsibilities before shortening mechanically.

## Bad

```ts
// File: src/component_registry.ts
export class ComponentRegistry {
	private readonly component_name: string;
	public constructor(component_name: string) { this.component_name = component_name; }
	public register_component_for_the_project_configuration_validation(): string { return `Validated ${this.component_name}`; } // <- error
	public report(): void {
		const result = this.register_component_for_the_project_configuration_validation();
		console.log(result);
	}
}
// File: cli.ts
import { ComponentRegistry } from "src/component_registry";
(function () {
	const registry = new ComponentRegistry("search-index");
	registry.report();
})();
```


## Good

```ts
// File: src/price_labels.ts
/** Responsibilities: _status label mapping_. **/
export class PriceLabels {
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
	public report(): void {
		const label = this.label("ready");
		const detailed = this.label_with_prefix("State", "blocked");
		const fallback = this.uppercase_fallback();
		const count = this.status_count();
		console.log(`${label} ${detailed} ${fallback} ${count}`);
	}
}
// File: cli.ts
import { PriceLabels } from "src/price_labels";

(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const price_labels = new PriceLabels(labels, "Unknown");
	price_labels.report();
})();
```
