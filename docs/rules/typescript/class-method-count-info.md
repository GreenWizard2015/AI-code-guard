# `class-method-count-info`

Description: Review whether a class with more than five public methods still has one cohesive API.

## Bad

Several unrelated operations have accumulated in one class.

```ts
// File: src/status_labels.ts
class StatusLabels {
	private readonly labels: ReadonlyMap<string, string>;
	private readonly fallback: string;
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this.labels = labels;
		this.fallback = fallback;
	}
	public label(status: string): string {
		const label = this.labels.get(status);
		if (label === undefined) { return this.fallback; }
		return label;
	}
	public label_with_prefix(prefix: string, status: string): string { return `${prefix}: ${this.label(status)}`; }
	public uppercase_fallback(): string {
		const normalized = this.fallback.trim();
		let uppercase = "";
		for (const character of normalized) { uppercase += character.toUpperCase(); }
		return uppercase;
	}
	public status_count(): number {
		let count = 0;
		for (const name of this.labels.keys()) { if (name.length > 0) { count += 1; } }
		return count;
	}
	public contains_status(status: string): boolean { return this.labels.has(status); }
	public first_status(): string {
		for (const name of this.labels.keys()) { return name; }
		return this.fallback;
	}
	public status_from_row(row: string): string { return row.split(",")[0]; }
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	const value = new StatusLabels(labels, "Unknown");
	console.log(value.label("ready"), value.label_with_prefix("State", "ready"), value.uppercase_fallback(),
		value.status_count(), value.contains_status("ready"), value.first_status(), value.status_from_row("ready,Ready"));
})();
```

## Good

Keep the cohesive label API; move row parsing to its owning component.

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
		if (label === undefined) { return this.fallback; }
		return label;
	}
	/** Responsibilities: _prefixed label composition_. **/
	public label_with_prefix(prefix: string, status: string): string { return `${prefix}: ${this.label(status)}`; }
	/** Responsibilities: _fallback capitalization_. **/
	public uppercase_fallback(): string { return this.fallback.trim().toUpperCase(); }
	/** Responsibilities: _mapping size reporting_. **/
	public status_count(): number {
		let count = 0;
		for (const name of this.labels.keys()) { if (name.length > 0) { count += 1; } }
		return count;
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	const value = new StatusLabels(labels, "Unknown");
	console.log(value.label("ready"), value.label_with_prefix("State", "ready"), value.uppercase_fallback(),
		value.status_count());
})();
```
