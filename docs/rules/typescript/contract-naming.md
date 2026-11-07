# contract-naming

Description: Interfaces must use `Contract` exactly once, as the final suffix.
Classes, type aliases, and
other declarations must not contain `Contract`, `Prot`, `Proto`, `Protocol`, or
`Interface`. Interface names must not contain `Prot`, `Proto`, `Protocol`, or
`Interface`.

## Bad

```ts
// File: src/cache_contract.ts
export class CacheContract {
	private readonly value: string;
	public constructor(value: string) {
		this.value = value;
	}
	public content_text(): string {
		const trimmed = this.value.trim();
		if (trimmed.length === 0) {
			return "";
		}
		const words = trimmed.split(/\s+/u);
		return words.join(" ");
	}
	public readable(): boolean {
		const content = this.content_text();
		const words = content.split(" ");
		for (const word of words) {
			if (word.length > 0) {
				return true;
			}
		}
		return false;
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const value_text = this.content_text();
		if (clean_prefix.length === 0) {
			return value_text;
		}
		return `${clean_prefix}: ${value_text}`;
	}
	public report(): void {
		const label = this.label("Cache");
		const populated = String(this.readable());
		console.log(`${label} | ${populated}`);
	}
}
// File: cli.ts
import { CacheContract } from "src/cache_contract";
(function () {
	const cache = new CacheContract("cached value");
	cache.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface CacheContract {
	content_text(): string;
	readable(): boolean;
	label(prefix: string): string;
}
// File: src/cache_entry.ts
import type { CacheContract } from "src/protocols";
export class CacheEntry implements CacheContract {
	private readonly _value: string;
	public constructor(value: string) {
		this._value = value;
	}
	public content_text(): string {
		const trimmed = this._value.trim();
		if (trimmed.length === 0) {
			return "";
		}
		const words = trimmed.split(/\s+/u);
		return words.join(" ");
	}
	public readable(): boolean {
		const content = this.content_text();
		const words = content.split(" ");
		for (const word of words) {
			if (word.length > 0) {
				return true;
			}
		}
		return false;
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const value_text = this.content_text();
		if (clean_prefix.length === 0) {
			return value_text;
		}
		return `${clean_prefix}: ${value_text}`;
	}
	public report(): void {
		const label = this.label("Cache");
		const populated = String(this.readable());
		console.log(`${label} | ${populated}`);
	}
}
// File: cli.ts
import { CacheEntry } from "src/cache_entry";
(function () {
	const cache = new CacheEntry("cached value");
	cache.report();
})();
```
