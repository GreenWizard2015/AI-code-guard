# `typeof`

Description: Validate values at a boundary and avoid repeated `typeof` checks in business logic.

## Bad

```ts
// File: src/text_type_report.ts
export class TextTypeReport {
	private readonly candidate: unknown;

	public constructor(candidate: unknown) {
		this.candidate = candidate;
	}

	public type_label(): string {
		const value = this.candidate;
		if (typeof value === "string" && typeof value !== "number") {
			return "text";
		}
		return "other";
	}

	public summary(): string {
		const label = this.type_label();
		return `Input type: ${label}`;
	}

	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { TextTypeReport } from "src/text_type_report";

(function run(): void {
	const report = new TextTypeReport("ready");
	report.report();
})();
```

## Good

```ts
// File: src/text_type_report.ts
export class TextTypeReport {
	private readonly _candidate: string;

	public constructor(candidate: string) {
		this._candidate = candidate;
	}

	public type_label(): string {
		return "text";
	}

	public populated(): boolean {
		return this._candidate.trim().length > 0;
	}

	public summary(): string {
		const label = this.type_label();
		const content = this.populated() ? "present" : "empty";
		return `Input type: ${label}; content: ${content}`;
	}

	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { TextTypeReport } from "src/text_type_report";

(function run(): void {
	const report = new TextTypeReport("ready");
	report.report();
})();
```
