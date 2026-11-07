# `overload`

Description: Keep one explicit callable contract. Model distinct outcomes with a named result or state type.

## Bad

```ts
// File: src/text_formatter.ts
export class TextFormatter {
	private readonly locale: string;

	public constructor(locale: string) {
		this.locale = locale;
	}

	public format(value: string): string;
	public format(value: number): string;
	public format(value: string | number): string {
		const text = String(value);
		const normalized = text.trim();
		return `${this.locale}:${normalized}`;
	}

	public format_uppercase(value: string): string {
		const formatted = this.format(value);
		const uppercase = formatted.toUpperCase();
		return uppercase.replaceAll(" ", "_");
	}

	public word_count(value: string): number {
		const normalized = value.trim();
		const words = normalized.split(/\s+/u);
		return words.length;
	}

	public report(): void {
		const formatted = this.format("ready");
		const uppercase = this.format_uppercase("ready");
		const count = this.word_count("ready value");
		const lines = [`Formatted: ${formatted}`, `Uppercase: ${uppercase}`, `Words: ${count}`];
		console.log(lines.join("\n"));
	}
}
// File: cli.ts
import { TextFormatter } from "src/text_formatter";
(function () {
	const formatter = new TextFormatter("en");
	formatter.report();
})();
```

## Good

```ts
// File: src/text_formatter.ts
export class TextFormatter {
	private readonly _locale: string;

	public constructor(locale: string) {
		this._locale = locale;
	}

	public format(value: string | number): string {
		const text = String(value);
		const normalized = text.trim();
		if (this._locale.trim().length === 0) {
			return normalized;
		}
		return `${this._locale}:${normalized}`;
	}

	public format_uppercase(value: string): string {
		const formatted = this.format(value);
		const uppercase = formatted.toUpperCase();
		return uppercase.replaceAll(" ", "_");
	}

	public word_count(value: string): number {
		const normalized = value.trim();
		const words = normalized.split(/\s+/u);
		return words.length;
	}

	public report(): void {
		const formatted = this.format("ready");
		const uppercase = this.format_uppercase("ready");
		const count = this.word_count("ready value");
		const lines = [`Formatted: ${formatted}`, `Uppercase: ${uppercase}`, `Words: ${count}`];
		console.log(lines.join("\n"));
	}
}
// File: cli.ts
import { TextFormatter } from "src/text_formatter";
(function () {
	const formatter = new TextFormatter("en");
	formatter.report();
})();
```
