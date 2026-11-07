# `typescript-literal-object-access`

Description: Do not access object members with string-literal bracket keys. Use direct member access for a known field; use a variable when the key is dynamic.

## Bad

```ts
// File: src/entry.ts
export class Entry {
	private readonly name: string;
	private readonly category: string;
	private readonly enabled: boolean;

	public constructor(name: string, category: string, enabled: boolean) {
		this.name = name;
		this.category = category;
		this.enabled = enabled;
	}

	public value(): string {
		return this["name"]; // <- error
	}

	public category_label(): string {
		const trimmed_category = this.category.trim();
		if (trimmed_category.length === 0) {
			return "uncategorized";
		}
		return trimmed_category.toUpperCase();
	}

	public visible(): boolean {
		return this.enabled && this.name.trim().length > 0;
	}

	public summary(): string {
		return `${this.value()} | ${this.category_label()} | ${this.visible()}`;
	}

	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { Entry } from "src/entry";

(() => {
	const entry = new Entry("document", "reference", true);
	entry.report();
})();
```

## Good

```ts
// File: src/entry.ts
export class Entry {
	private readonly _name: string;
	private readonly _category: string;
	private readonly _enabled: boolean;

	public constructor(name: string, category: string, enabled: boolean) {
		this._name = name;
		this._category = category;
		this._enabled = enabled;
	}

	public value(): string {
		return this._name;
	}

	public category_label(): string {
		const trimmed_category = this._category.trim();
		if (trimmed_category.length === 0) {
			return "uncategorized";
		}
		return trimmed_category.toUpperCase();
	}

	public visible(): boolean {
		return this._enabled && this._name.trim().length > 0;
	}

	public summary(): string {
		return `${this.value()} | ${this.category_label()} | ${this.visible()}`;
	}

	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { Entry } from "src/entry";

(() => {
	const entry = new Entry("document", "reference", true);
	entry.report();
})();
```
