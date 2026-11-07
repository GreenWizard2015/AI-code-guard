# `numeric-name`

Description: Names of project-owned symbols must not contain numbers. This applies to
classes, types, fields, methods, functions, parameters, and local variables in
both TypeScript and Python.

```ts
const item1 = load_item();
class Version2 {}
```

Use a descriptive word instead:

```ts
const first_item = load_item();
class SecondVersion {}
```

The rule does not inspect test files, consistent with the project policy that
test names and test-local naming are outside naming checks. External runtime
names are not declarations owned by the project and are not renamed by this
rule.

## Bad

```ts
// File: src/status.ts
export class Status {
	private readonly value: string;
	public constructor(value: string) { this.value = value; }
	public normalized(): string { return this.value.trim().toLowerCase(); }
	public ready(): boolean { return this.normalized() === "ready"; }
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		const status_value = this.normalized();
		if (normalized_fragment.length === 0) { return false; }
		return status_value.includes(normalized_fragment);
	}
	public label(item1: string): string { return `${item1}: ${this.normalized()}`; }
	public report(): void {
		const normalized = this.normalized();
		const ready = this.ready();
		const label = this.label("State");
		console.log(normalized, ready, label, this.contains("ead"));
	}
}
// File: cli.ts
import { Status } from "src/status";
(function () {
	const status = new Status(" READY ");
	status.report();
})();
```

## Good

```ts
// File: src/status.ts
export class Status {
	private readonly _value: string;
	private readonly _normalized_values: Map<string, string>;
	public constructor(value: string) {
		this._value = value;
		this._normalized_values = new Map();
	}
	public normalized(): string {
		const cached_value = this._normalized_values.get(this._value);
		if (cached_value !== undefined) {
			return cached_value;
		}
		const normalized_value = this._value.trim().toLowerCase();
		this._normalized_values.set(this._value, normalized_value);
		return normalized_value;
	}
	public ready(): boolean { return this.normalized() === "ready"; }
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		const status_value = this.normalized();
		if (normalized_fragment.length === 0) { return false; }
		return status_value.includes(normalized_fragment);
	}
	public label(prefix: string): string { return `${prefix}: ${this.normalized()}`; }
	public report(): void {
		const normalized = this.normalized();
		const ready = this.ready();
		const label = this.label("State");
		console.log(normalized, ready, label, this.contains("ead"));
	}
}
// File: cli.ts
import { Status } from "src/status";
(function () {
	const status = new Status(" READY ");
	status.report();
})();
```
