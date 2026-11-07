# `type-warning`

Description: Give every TypeScript field a concrete value type. Fields retain state across method
calls, so their declared contract must describe the values they store.

## Bad

```ts
// File: src/text_value.ts
export class TextValue {
	private readonly value: unknown;
	public constructor(value: string) {
		this.value = value;
	}
	public normalized_text(): string {
		const raw_text = String(this.value).trim();
		if (raw_text.length === 0) {
			return "";
		}
		const words = raw_text.split(/\s+/u);
		const normalized_words: string[] = [];
		for (const word of words) {
			if (word.length > 0) {
				normalized_words.push(word);
			}
		}
		return normalized_words.join(" ");
	}
	public ready(): boolean {
		const normalized = this.normalized_text();
		if (normalized.length === 0) {
			return false;
		}
		return normalized === "ready";
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const normalized = this.normalized_text();
		if (clean_prefix.length === 0) {
			return normalized;
		}
		return `${clean_prefix}: ${normalized}`;
	}
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		if (normalized_fragment.length === 0) {
			return false;
		}
		return this.normalized_text().toLowerCase().includes(normalized_fragment);
	}
	public report(): void {
		const fields = [
			this.normalized_text(),
			String(this.ready()),
			this.label("State"),
			String(this.contains("ead")),
		];
		console.log(fields.join(" | "));
	}
}
// File: cli.ts
import { TextValue } from "src/text_value";
(function () {
	const value = new TextValue("ready");
	value.report();
})();
```

## Good

```ts
// File: src/text_value.ts
export class TextValue {
	private readonly _normalized_cache: Map<string, string>;
	private readonly _value: string;
	public constructor(value: string) {
		this._value = value;
		this._normalized_cache = new Map();
	}
	public normalized_text(): string {
		const cached = this._normalized_cache.get(this._value);
		if (cached !== undefined) { return cached; }
		const normalized = this._value.trim().replace(/\s+/gu, " ");
		this._normalized_cache.set(this._value, normalized);
		return normalized;
	}
	public ready(): boolean {
		const normalized = this.normalized_text();
		if (normalized.length === 0) {
			return false;
		}
		return normalized.toLowerCase() === "ready";
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const normalized = this.normalized_text();
		if (clean_prefix.length === 0) {
			return normalized;
		}
		return `${clean_prefix}: ${normalized}`;
	}
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		if (normalized_fragment.length === 0) {
			return false;
		}
		return this.normalized_text().toLowerCase().includes(normalized_fragment);
	}
	public report(): void {
		const fields = [
			this.normalized_text(),
			String(this.ready()),
			this.label("State"),
			String(this.contains("ead")),
		];
		console.log(fields.join(" | "));
	}
}
// File: cli.ts
#!/usr/bin/env node
import { TextValue } from "src/text_value";
(function () {
	const value = new TextValue("ready");
	value.report();
})();
```
