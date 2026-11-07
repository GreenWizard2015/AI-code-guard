# `method-load-read-open-name`

Description: Review public non-boolean result methods beginning with `load*`, `read*`, or
`open*`. Prefer the returned value or representation: `content()` may read a
file, use a cache, call HTTP, or return an existing object without exposing
that implementation choice.

## Bad

```ts
// File: src/document_content.ts
export class DocumentContent {
	private readonly title_text: string;
	private readonly body_text: string;
	public constructor(title_text: string, body_text: string) {
		this.title_text = title_text;
		this.body_text = body_text;
	}
	public load_content(): string { return this.body_text; } // <- error
	public word_count(): number { return this.body_text.trim().split(/\s+/).length; }
	public summary(): string {
		const content = this.load_content();
		const words = this.word_count();
		return `${this.title_text}: ${words} words; ${content}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { DocumentContent } from "src/document_content";
(function () {
	const document = new DocumentContent("Welcome", "A short guide to the library.");
	document.report();
})();
```

## Good

```ts
// File: src/document_content.ts
export class DocumentContent {
	private readonly _title_text: string;
	private readonly _body_text: string;
	public constructor(title_text: string, body_text: string) {
		this._title_text = title_text;
		this._body_text = body_text;
	}
	public content(): string { return this._body_text; }
	public word_count(): number {
		if (this._body_text.trim().length === 0) { return 0; }
		return this._body_text.trim().split(/\s+/).length;
	}
	public summary(): string {
		const content = this.content();
		const words = this.word_count();
		return `${this._title_text}: ${words} words; ${content}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { DocumentContent } from "src/document_content";
(function () {
	const document = new DocumentContent("Welcome", "A short guide to the library.");
	document.report();
})();
```
