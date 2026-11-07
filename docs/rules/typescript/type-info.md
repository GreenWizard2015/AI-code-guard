# `type-info`

Description: Prefer a concrete value contract or focused protocol over unbounded boundary types.

This applies to both languages. In TypeScript it includes `any`, `unknown`, and
`object`; in Python it includes `Any`, `typing.Any`, `typing_extensions.Any`,
`object`, and equivalent unbounded aliases. Use a concrete value type or a
focused protocol instead.

## Bad

```ts
// File: src/message.ts
export class Message {
	private readonly value: unknown;
	private readonly context: string;
	public constructor(value: unknown, context: string) {
		this.value = value;
		this.context = context;
	}
	public render(): string {
		const text = String(this.value).trim();
		if (text.length === 0) { return "(empty)"; }
		return text;
	}
	public normalized_text(): string { return this.render().trim().toLowerCase(); }
	public words(): string[] {
		const text = this.normalized_text();
		if (text === "(empty)") { return []; }
		return text.split(/\s+/u).filter((word) => word.length > 0);
	}
	public report(): void {
		const display_text = this.render();
		const count = this.words().length;
		console.log(`${this.context}: ${display_text}: ${count}`);
	}
}
// File: cli.ts
import { Message } from "src/message";
(function () { const message = new Message("READY", "queue"); message.report(); })();
```


## Good

```ts
// File: src/message.ts
export class Message {
	private readonly _render_cache: Map<string, string>;
	private readonly _value: string;
	private readonly _context: string;
	public constructor(value: string, context: string) {
		this._value = value;
		this._context = context;

		this._render_cache = new Map();}
	public render(): string {
		const cached = this._render_cache.get(this._value);
		if (cached !== undefined) { return cached; }
		const text = this._value.trim();
		if (text.length === 0) {
			this._render_cache.set(this._value, "(empty)");
			return "(empty)";
		}
		this._render_cache.set(this._value, text);
		return text;
	}
	public normalized_text(): string { return this.render().trim().toLowerCase(); }
	public words(): string[] {
		const text = this.normalized_text();
		if (text === "(empty)") { return []; }
		return text.split(/\s+/u).filter((word) => word.length > 0);
	}
	public report(): void {
		const display_text = this.render();
		const count = this.words().length;
		console.log(`${this._context}: ${display_text}: ${count}`);
	}
}
// File: cli.ts
import { Message } from "src/message";
(function () { const message = new Message("READY", "queue"); message.report(); })();
```

