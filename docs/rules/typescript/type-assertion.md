# `type-assertion`

Description: Do not silence the TypeScript checker with explicit type assertions.

```ts
const value = input as Result;
const other = <Result>input;
```

Validate external data at its boundary, use an AST/type predicate, or change
the contract so the compiler can prove the type. `as const` is a literal
inference declaration, not a runtime type cast, and is not reported by this
rule.

As an alternative to an assertion, use one `typeof` check at the external input
boundary and return the explicit domain type. Do not repeat the check in business
logic.

## Bad

```ts
// File: src/status_labels.ts
export class StatusLabels {
	private readonly labels: ReadonlyMap<string, string>;
	private readonly fallback: string;
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this.labels = labels;
		this.fallback = fallback;
	}
	public label(status: string): string {
		return status as string; // <- error
	}
	public label_with_prefix(prefix: string, key: string): string {
		return `${prefix}: ${this.label(key)}`;
	}
	public uppercase_fallback(): string {
		return this.fallback.trim().toUpperCase();
	}
	public status_count(): number {
		return this.labels.size;
	}
	public report(lines: string[]): void {
		console.log(lines.join(" "));
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	const status_labels = new StatusLabels(labels, "Unknown");
	status_labels.report([
		status_labels.label("ready"),
		status_labels.label_with_prefix("State", "ready"),
		status_labels.uppercase_fallback(),
		String(status_labels.status_count()),
	]);
})();
```

## Good

```ts
// File: src/status_labels.ts
export class StatusLabels {
	private readonly _labels: ReadonlyMap<string, string>;
	private readonly _fallback: string;
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this._labels = labels;
		this._fallback = fallback;
	}
	public label(status: string): string {
		return status.trim();
	}
	public label_with_prefix(prefix: string, key: string): string {
		return `${prefix}: ${this.label(key)}`;
	}
	public uppercase_fallback(): string {
		return this._fallback.trim().toUpperCase();
	}
	public status_count(): number {
		return this._labels.size;
	}
	public report(lines: string[]): void {
		console.log(lines.join(" "));
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	const status_labels = new StatusLabels(labels, "Unknown");
	status_labels.report([
		status_labels.label("ready"),
		status_labels.label_with_prefix("State", "ready"),
		status_labels.uppercase_fallback(),
		String(status_labels.status_count()),
	]);
})();
```
