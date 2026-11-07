# `naming-type`

Description: Name type declarations with PascalCase and without underscores.

## Bad

```ts
// File: src/types.ts
export type item_count = number; // <- error
// File: src/count_reporter.ts
import type { item_count } from "src/types";

export class CountReporter {
	private readonly count: item_count;
	public constructor(count: item_count) { this.count = count; }
	public normalized_count(): number { return Math.max(0, this.count); }
	public digit_count(): number {
		const rendered_count = String(this.normalized_count());
		return rendered_count.length;
	}
	public count_label(): string {
		const normalized = this.normalized_count();
		const digits = this.digit_count();
		return `Items: ${normalized} (${digits} digits)`;
	}
	public positive(): boolean { return this.normalized_count() > 0; }
	public report(): void {
		const label = this.count_label();
		const positive = this.positive();
		console.log(`${label} positive=${positive}`);
	}
}
// File: cli.ts
import { CountReporter } from "src/count_reporter";
(function () {
	const reporter = new CountReporter(3);
	reporter.report();
})();
```

## Good

```ts
// File: src/types.ts
export type ItemCount = number;
// File: src/count_reporter.ts
import type { ItemCount } from "src/types";

export class CountReporter {
	private readonly _count: ItemCount;
	public constructor(count: ItemCount) { this._count = count; }
	public normalized_count(): number { return Math.max(0, this._count); }
	public digit_count(): number {
		const rendered_count = String(this.normalized_count());
		return rendered_count.length;
	}
	public count_label(): string {
		const normalized = this.normalized_count();
		const digits = this.digit_count();
		return `Items: ${normalized} (${digits} digits)`;
	}
	public positive(): boolean { return this.normalized_count() > 0; }
	public report(): void {
		const label = this.count_label();
		const positive = this.positive();
		console.log(`${label} positive=${positive}`);
	}
}
// File: cli.ts
import { CountReporter } from "src/count_reporter";
(function () {
	const reporter = new CountReporter(3);
	reporter.report();
})();
```
