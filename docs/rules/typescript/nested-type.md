# `nested-type`

Description: Type declarations must be top-level so their ownership and reuse remain visible.
The rule covers TypeScript type aliases, interfaces, and enums, plus Python `TypeAlias`,
`TypeAliasType`, and structural type declarations nested inside classes, functions, or other
scopes. Nested classes are reported separately by `nested-class`.

Fix: Move each type declaration to a focused top-level module and import it where needed.

## Bad

```ts
// File: src/status_reporter.ts
export class StatusReporter {
	private readonly heading: string;
	private readonly value: string;

	public constructor(heading: string, value: string) {
		this.heading = heading;
		this.value = value;
	}

	public normalize(): string {
		const words = this.value.trim().toLowerCase().split(/\s+/u);
		return words.join(" ");
	}

	public classify(): string {
		const normalized = this.normalize();
		let state = "unknown";
		if (normalized === "ready") {
			state = "ready";
		}
		if (normalized === "blocked") {
			state = "blocked";
		}
		return state;
	}

	public label(): string {
		const normalized = this.normalize();
		return `${this.heading}: ${normalized}`;
	}

	public summary(): string {
		const label = this.label();
		const state = this.classify();
		return `${label} [${state}]`;
	}

	public report(): void {
		const summary = this.summary();
		const length = this.normalize().length;
		console.log(`${summary} (${length} characters)`);
	}
}
// File: cli.ts
import { StatusReporter } from "src/status_reporter";

(function () {
	type LocalStatus = "ready" | "blocked";
	const value: LocalStatus = "ready";
	const reporter = new StatusReporter("Status", value);
	reporter.report();
})();
```


## Good

```ts
// File: src/status_reporter.ts
export class StatusReporter {
	private readonly _heading: string;
	private readonly _value: string;

	public constructor(heading: string, value: string) {
		this._heading = heading;
		this._value = value;
	}

	public normalize(): string {
		const words = this._value.trim().toLowerCase().split(/\s+/u);
		return words.join(" ");
	}

	public classify(): string {
		if (this._value.trim().length === 0) {
			return "unknown";
		}
		const normalized = this.normalize();
		let state = "unknown";
		if (normalized === "ready") {
			state = "ready";
		}
		if (normalized === "blocked") {
			state = "blocked";
		}
		return state;
	}

	public label(): string {
		const normalized = this.normalize();
		return `${this._heading}: ${normalized}`;
	}

	public summary(): string {
		const label = this.label();
		const state = this.classify();
		return `${label} [${state}]`;
	}

	public report(): void {
		const summary = this.summary();
		const length = this.normalize().length;
		console.log(`${summary} (${length} characters)`);
	}
}
// File: src/types.ts
export type Status = "ready" | "blocked";
// File: cli.ts
import type { Status } from "src/types";
import { StatusReporter } from "src/status_reporter";

(function () {
	const value: Status = "ready";
	const reporter = new StatusReporter("Status", value);
	reporter.report();
})();
```

