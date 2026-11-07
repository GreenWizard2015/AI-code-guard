# `complex-default-parameter`

Description: Parameter defaults must not allocate dependencies or mutable state before the
caller's lifecycle is explicit. Avoid objects, factories, callbacks, and mutable
collections as defaults. Primitive literal defaults such as strings are allowed.

## Bad

```ts
// File: src/status_labels.ts
export class StatusLabels {
	private readonly labels: ReadonlyMap<string, string>;
	private readonly fallback: string;
	public constructor(labels: ReadonlyMap<string, string> = new Map([["ready", "Ready"]]), fallback: string = "Unknown") { // <- error
		this.labels = labels;
		this.fallback = fallback;
	}
	public label(status: string): string {
		const label = this.labels.get(status);
		if (label === undefined) { return this.fallback; }
		return label;
	}
	public label_with_prefix(prefix: string, status: string): string {
		return `${prefix}: ${this.label(status)}`;
	}
	public uppercase_fallback(): string {
		return this.fallback.trim().toUpperCase();
	}
	public status_count(): number {
		let count = 0;
		for (const status_name of this.labels.keys()) {
			if (status_name.length > 0) { count += 1; }
		}
		return count;
	}
	public report(): void {
		const label = this.label("ready");
		const detailed = this.label_with_prefix("State", "ready");
		const fallback = this.uppercase_fallback();
		const count = this.status_count();
		console.log(`${label} ${detailed} ${fallback} ${count}`);
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new StatusLabels();
	labels.report();
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
	public constructor(labels: ReadonlyMap<string, string>, fallback: string = "Unknown") {
		this._labels = labels;
		this._fallback = fallback;
	}
	/** Responsibilities: _status label selection_. **/
	public label(status: string): string {
		const label = this._labels.get(status);
		if (label === undefined) { return this._fallback; }
		return label;
	}
	/** Responsibilities: _prefixed label composition_. **/
	public label_with_prefix(prefix: string, status: string): string {
		return `${prefix}: ${this.label(status)}`;
	}
	/** Responsibilities: _fallback capitalization_. **/
	public uppercase_fallback(): string {
		return this._fallback.trim().toUpperCase();
	}
	/** Responsibilities: _mapping size reporting_. **/
	public status_count(): number {
		let count = 0;
		for (const status_name of this._labels.keys()) {
			if (status_name.length > 0) { count += 1; }
		}
		return count;
	}
	/** Responsibilities: _status report output_. **/
	public report(): void {
		const label = this.label("ready");
		const detailed = this.label_with_prefix("State", "blocked");
		const fallback = this.uppercase_fallback();
		const count = this.status_count();
		console.log(`${label} ${detailed} ${fallback} ${count}`);
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const status_labels = new StatusLabels(labels);
	status_labels.report();
})();
```
