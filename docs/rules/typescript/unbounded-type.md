# `unbounded-type`

Description: Do not use `any` or `unknown` in TypeScript, or `Any` in Python. The rule applies to
all type annotations recognized by the AST, including parameters, fields, return values, and
generic type positions.

Bad examples annotate values as `unknown` or `any` instead of using a concrete domain type.

Fix: Replace the unbounded type with a concrete domain type or focused protocol.

## Bad

```ts
// File: src/value_report.ts
export class ValueReport {
	private readonly value: unknown;
	public constructor(value: unknown) {
		this.value = value;
	}
	public normalized_value(): string {
		return String(this.value);
	}
	public report(): void {
		console.log(this.normalized_value());
	}
}
// File: cli.ts
import { ValueReport } from "src/value_report";
(function () {
	const report = new ValueReport(42);
	report.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface ValueTextContract {
	normalized_value(): string;
	populated(): boolean;
	report(): void;
}
// File: src/value_text.ts
import type { ValueTextContract } from "src/protocols";

export class ValueText implements ValueTextContract {
	private readonly _value: string;
	public constructor(value: string) {
		this._value = value;
	}
	public normalized_value(): string {
		return this._value.trim().toUpperCase();
	}
	public populated(): boolean {
		return this.normalized_value().length > 0;
	}
	public word_count(): number {
		const words = this.normalized_value().split(/\s+/u);
		if (words.length === 1 && words[0] === "") { return 0; }
		return words.length;
	}
	public summary(): string {
		const normalized = this.normalized_value();
		const word_count = this.word_count();
		return `${normalized} (${word_count} words)`;
	}
	public report(): void {
		console.log(`${this.summary()} | ${this.populated()}`);
	}
}
// File: cli.ts
import { ValueText } from "src/value_text";
(function () {
	const value = new ValueText("ready");
	value.report();
})();
```
