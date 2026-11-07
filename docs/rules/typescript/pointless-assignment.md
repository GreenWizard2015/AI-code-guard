# `pointless-assignment`

Description: A temporary assigned and immediately returned value adds indirection.

```ts
const BUILT_VALUE = build(input);
return BUILT_VALUE;
```

## Bad

```ts
// File: src/message.ts
export class Message {
	private readonly content: string;
	private readonly category: string;
	private readonly channel: string;
	public constructor(content: string, category: string, channel: string) {
		this.content = content;
		this.category = category;
		this.channel = channel;
	}
	public render(): string {
		const display_text = `[${this.content.trim()}]`;
		return display_text;
	}
	public summary(): string {
		const text = this.render();
		const category_label = this.category.toUpperCase();
		return `${category_label}@${this.channel}: ${text} (${text.length})`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { Message } from "src/message";
(function () { const message = new Message(" ready ", "status", "console"); message.report(); })();
```


**Fix:** Return `build(input)` directly unless the name is reused or documents a real transition.

The target diagnostic is demonstrated by the `result` assignment immediately returned above.

## Good

```ts
// File: src/message.ts
export class Message {
	private readonly _render_cache: Map<string, string>;
	private readonly _content: string;
	private readonly _category: string;
	private readonly _channel: string;
	public constructor(content: string, category: string, channel: string) {
		this._content = content;
		this._category = category;
		this._channel = channel;

		this._render_cache = new Map();}
	public render(): string {
		const cached = this._render_cache.get(this._content);
		if (cached !== undefined) { return cached; }
		const rendered = `[${this._content.trim()}]`;
		this._render_cache.set(this._content, rendered);
		return rendered;
	}
	public summary(): string {
		const text = this.render();
		const category_label = this._category.toUpperCase();
		return `${category_label}@${this._channel}: ${text} (${text.length})`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { Message } from "src/message";
(function () { const message = new Message(" ready ", "status", "console"); message.report(); })();
```

