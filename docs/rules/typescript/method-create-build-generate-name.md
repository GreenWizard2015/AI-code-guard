# `method-create-build-generate-name`

Description: Review public non-boolean result methods beginning with `create*`, `build*`,
or `generate*`. Prefer the returned value: `createUser()` → `user()` and
`generateToken()` → `token()`.

Allow the exact `build()` operation on a `*Registry` class: it names producing
the source-specific registry result. Compound names such as `buildReport()` are
still reported.

This does not prohibit concrete commands. A method that changes the outside
world should use a verb and normally return `void`/`None`, such as
`register(user)` or `publish(article)`.

## Bad

```ts
// File: src/price_labels.ts
export class PriceLabels {
	private readonly labels: ReadonlyMap<string, string>;
	private readonly fallback: string;

	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this.labels = labels;
		this.fallback = fallback;
	}

	public label(status: string): string {
		const label = this.labels.get(status);
		if (label === undefined) {
			return this.fallback;
		}
		return label;
	}

	public status_count(): number {
		let count = 0;
		for (const status of this.labels.keys()) {
			if (status.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	public create_receipt(status: string): string {
		const label = this.label(status);
		const count = this.status_count();
		return `${status}: ${label} (${count} labels)`;
	}

	public report(): void {
		const receipt = this.create_receipt("ready");
		console.log(receipt);
	}
}
// File: cli.ts
import { PriceLabels } from "src/price_labels";

(function run(): void {
	const labels = new Map<string, string>([["ready", "Ready"]]);
	const price_labels = new PriceLabels(labels, "Unknown");
	price_labels.report();
})();
```


## Good

```ts
// File: src/price_labels.ts
/** Responsibilities: _status label mapping_. **/
export class PriceLabels {
	private readonly _labels: ReadonlyMap<string, string>;
	private readonly _fallback: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this._labels = labels;
		this._fallback = fallback;
	}

	/** Responsibilities: _status label selection_. **/
	public label(status: string): string {
		const label = this._labels.get(status);
		if (label === undefined) {
			return this._fallback;
		}
		return label;
	}

	/** Responsibilities: _prefixed label composition_. **/
	public label_with_prefix(prefix: string, status: string): string {
		const label = this.label(status);
		return `${prefix}: ${label}`;
	}

	/** Responsibilities: _fallback capitalization_. **/
	public uppercase_fallback(): string {
		const normalized = this._fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _mapping size reporting_. **/
	public status_count(): number {
		let count = 0;
		for (const status_name of this._labels.keys()) {
			if (status_name.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _receipt summary reporting_. **/
	public report(): void {
		const label = this.label("ready");
		const detailed = this.label_with_prefix("State", "blocked");
		const fallback = this.uppercase_fallback();
		const count = this.status_count();
		console.log(`${label} ${detailed} ${fallback} ${count}`);
	}
}
// File: cli.ts
import { PriceLabels } from "src/price_labels";

(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const price_labels = new PriceLabels(labels, "Unknown");
	price_labels.report();
})();
```
