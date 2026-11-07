# `constants-file-content`

Description: Files named `constants.ts` or `constants.py` contain constant values only. Keep
classes, functions, and types in their focused implementation or contract files.

## Bad

```ts
// File: src/constants.ts
export class SearchCapacity {
	private readonly scope_name: string;
	private readonly requested_limit: number;
	public constructor(scope_name: string, requested_limit: number) {
		this.scope_name = scope_name;
		this.requested_limit = requested_limit;
	}
	public effective_limit(): number { return Math.max(0, this.requested_limit); }
	public limit_label(): string { return `${this.scope_name}: ${this.effective_limit()} items`; }
	public accepts(value: number): boolean { return value <= this.effective_limit(); }
	public report(): void {
		const label = this.limit_label();
		const accepted = this.accepts(4);
		console.log(`${label} accepted=${accepted}`);
	}
}
// File: cli.ts
import { SearchCapacity } from "src/constants";
(function () {
	const capacity = new SearchCapacity("Search", 8);
	capacity.report();
})();
```

## Good

```ts
// File: src/constants.ts
export const DEFAULT_LIMIT = 10;
// File: src/search_capacity.ts
import { DEFAULT_LIMIT } from "src/constants";

export class SearchCapacity {
	private readonly _scope_name: string;
	private readonly _requested_limit: number;
	public constructor(scope_name: string, requested_limit: number) {
		this._scope_name = scope_name;
		this._requested_limit = requested_limit;
	}
	public effective_limit(): number {
		if (this._requested_limit > DEFAULT_LIMIT) {
			return DEFAULT_LIMIT;
		}
		if (this._requested_limit < 0) {
			return 0;
		}
		return this._requested_limit;
	}
	public limit_label(): string {
		return `${this._scope_name}: ${this.effective_limit()} items`;
	}
	public accepts(value: number): boolean {
		return value <= this.effective_limit();
	}
	public report(): void {
		const label = this.limit_label();
		const accepted = this.accepts(4);
		console.log(`${label} accepted=${accepted}`);
	}
}
// File: cli.ts
import { SearchCapacity } from "src/search_capacity";
(function () {
	const capacity = new SearchCapacity("Search", 8);
	capacity.report();
})();
```
