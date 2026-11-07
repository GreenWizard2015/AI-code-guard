# `ternary-expression`

Description: Use explicit branches when a conditional expression hides a state transition.

## Bad

```ts
// File: src/cache_result.ts
/** Responsibilities: _cache result state_. **/
export class CacheResult {
	private readonly ready: boolean;
	private readonly cached_value: string;
	private readonly fallback_value: string;

	/** Responsibilities: _cache result initialization_. **/
	public constructor(ready: boolean, cached_value: string, fallback_value: string) {
		this.ready = ready;
		this.cached_value = cached_value;
		this.fallback_value = fallback_value;
	}

	/** Responsibilities: _cache source selection_. **/
	public select_source(): string {
		let source: string;
		if (this.ready) {
			source = "cache";
		} else {
			source = "fallback";
		}
		const normalized = source.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _cache value selection_. **/
	public select_value(): string {
		const value = this.ready ? this.cached_value.trim() : this.fallback_value.trim(); // <- error
		return value.trim();
	}

	/** Responsibilities: _cache result reporting_. **/
	public report(): string {
		const source = this.select_source();
		const value = this.select_value();
		const result = `${source}:${value}`;
		console.log(result);
		return result;
	}
}
// File: cli.ts
import { CacheResult } from "src/cache_result";

(function () {
	const result = new CacheResult(true, "loaded", "reserve");
	result.report();
})();
```

## Good

```ts
// File: src/cache_result.ts
/** Responsibilities: _cache result state_. **/
export class CacheResult {
	private readonly _ready: boolean;
	private readonly _cached_value: string;
	private readonly _fallback_value: string;

	/** Responsibilities: _cache result initialization_. **/
	public constructor(ready: boolean, cached_value: string, fallback_value: string) {
		this._ready = ready;
		this._cached_value = cached_value;
		this._fallback_value = fallback_value;
	}

	/** Responsibilities: _cache source selection_. **/
	public select_source(): string {
		let source: string;
		if (this._ready) {
			source = "cache";
		} else {
			source = "fallback";
		}
		const normalized = source.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _cache value selection_. **/
	public select_value(): string {
		let value: string;
		if (this._ready) {
			value = this._cached_value.trim();
		} else {
			value = this._fallback_value.trim();
		}
		return value.trim();
	}

	/** Responsibilities: _cache result reporting_. **/
	public report(): string {
		const source = this.select_source();
		const value = this.select_value();
		const result = `${source}:${value}`;
		console.log(result);
		return result;
	}
}
// File: cli.ts
import { CacheResult } from "src/cache_result";

(function () {
	const result = new CacheResult(true, "loaded", "reserve");
	result.report();
})();
```
