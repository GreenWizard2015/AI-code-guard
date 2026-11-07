# `parse-error`

Description: Fix syntax errors before relying on structural lint diagnostics.

## Bad

```ts
// File: src/broken.ts
export const value: = "ready";
// File: src/parse_report.ts
export class ParseReport {
	private readonly file_name: string;
	private readonly errors: readonly string[];
	public constructor(file_name: string, errors: readonly string[]) {
		this.file_name = file_name;
		this.errors = errors;
	}
	public summary(): string {
		const lines: string[] = [this.file_name];
		for (const error of this.errors) {
			const normalized_error = error.trim();
			if (normalized_error.length > 0) { lines.push(normalized_error); }
		}
		if (this.errors.length === 0) { lines.push("clean"); }
		return lines.join(": ");
	}
	public error_count(): number {
		let count = 0;
		for (const error of this.errors) {
			if (error.trim().length > 0) { count += 1; }
		}
		return count;
	}
	public report(): void {
		const summary = this.summary();
		const count = this.error_count();
		console.log(`${summary} (${count})`);
	}
}
// File: cli.ts
import { ParseReport } from "src/parse_report";
(function () { const report = new ParseReport("broken.ts", ["syntax error"]); report.report(); })();
```

## Good

```ts
// File: src/constants.ts
export const VALUE = "ready";
// File: src/parse_report.ts
export class ParseReport {
	private readonly _file_name: string;
	private readonly _errors: readonly string[];
	public constructor(file_name: string, errors: readonly string[]) {
		this._file_name = file_name;
		this._errors = errors;
	}
	public summary(): string {
		const lines: string[] = [this._file_name];
		for (const error of this._errors) {
			const normalized_error = error.trim();
			if (normalized_error.length > 0) { lines.push(normalized_error); }
		}
		if (this._errors.length === 0) { lines.push("clean"); }
		return lines.join(": ");
	}
	public error_count(): number {
		let count = 0;
		for (const error of this._errors) {
			if (error.trim().length > 0) { count += 1; }
		}
		return count;
	}
	public report(): void {
		const summary = this.summary();
		const count = this.error_count();
		console.log(`${summary} (${count})`);
	}
}
// File: cli.ts
import { ParseReport } from "src/parse_report";
import { VALUE } from "src/constants";
(function () { const report = new ParseReport("reader.ts", [VALUE]); report.report(); })();
```
