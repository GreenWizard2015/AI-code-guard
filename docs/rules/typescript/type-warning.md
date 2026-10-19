# `type-warning`

Description: Give every TypeScript field a concrete value type. Fields retain state across method
calls, so their declared contract must describe the values they store.

## Bad

```ts
class TextValue {
	private readonly value: unknown;
	public constructor(value: string) { this.value = value; }
	public normalized_text(): string { return String(this.value).trim(); }
}
```

## Good

```ts
class TextValue {
	private readonly value: string;
	public constructor(value: string) { this.value = value; }
	public normalized(): string {
		return this.value.trim().toLowerCase();
	}
	public ready(): boolean {
		const normalized_value = this.normalized();
		const expected_value = 'ready';
		return normalized_value === expected_value;
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const status_value = this.normalized();
		return `${clean_prefix}: ${status_value}`;
	}
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		const status_value = this.normalized();
		if (normalized_fragment.length === 0) {
			return false;
		}
		return status_value.includes(normalized_fragment);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { TextValue } from "src/text_value";
(function () {
	const value = new TextValue("ready");
	console.log(value.normalized(), value.ready(), value.label("state"), value.contains("ead"));
})();
```
