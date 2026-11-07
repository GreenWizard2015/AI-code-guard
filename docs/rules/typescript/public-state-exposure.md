# public-state-exposure

Description: An implementation class must not expose mutable collection state directly.

## Bad

```ts
// File: src/registry.ts
export interface Item { label: string; }
export class Registry {
	public items: Map<string, Item>;
	public constructor(items: Map<string, Item>) { this.items = items; }
	public report(): void {
		const labels = Array.from(this.items.values()).map((item) => item.label);
		console.log(labels.join(", "));
	}
}
// File: cli.ts
import { Registry } from "src/registry";
import type { Item } from "src/registry";
(function () {
	const items = new Map<string, Item>([["primary", { label: "ready" }]]);
	const registry = new Registry(items);
	registry.report();
})();
```


Make the collection private or protected and expose a read-only view or a
method that owns mutations. The rule ignores `readonly` fields, private and
protected fields, interfaces, protocols, and data contracts.

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

	public report(): void {
		const label = this.label("ready");
		const detailed = this.label_with_prefix("State", "blocked");
		const fallback = this.uppercase_fallback();
		console.log(`${label} ${detailed} ${fallback}`);
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
