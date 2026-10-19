# `boolean-has-can-name`

Description: Prefer a natural boolean name such as `readable()` when it expresses the same
contract as `can_read()`. Do not invent awkward adjectives.

## Bad

```ts
// File: src/content_record.ts
export class ContentRecord {
	private readonly content: string;
	public constructor(content: string) {
		this.content = content;
	}
	public word_count(): number {
		const normalized = this.content.trim();
		if (normalized.length === 0) {
			return 0;
		}
		return normalized.split(/\s+/u).length;
	}
	public line_count(): number { return this.content.split(/\r?\n/u).length; }
	public can_read(): boolean { return this.content.trim().length > 0; } // <- error
	public summary(): string {
		const words = this.word_count();
		return `${words} words in ${this.line_count()} lines`;
	}
}
// File: cli.ts
import { ContentRecord } from "src/content_record";
(function () {
	const record = new ContentRecord("hello world");
	console.log(record.can_read(), record.summary());
})();
```

## Good

```ts
// File: src/content_record.ts
/** Responsibilities: _file readability_. **/
export class ContentRecord {
	private readonly content: string;
	/** Responsibilities: _entry initialization_. **/
	public constructor(content: string) {
		this.content = content;
	}
	/** Responsibilities: _word counting_. **/
	public word_count(): number {
		const normalized = this.content.trim();
		if (normalized.length === 0) {
			return 0;
		}
		return normalized.split(/\s+/u).length;
	}
	/** Responsibilities: _line counting_. **/
	public line_count(): number { return this.content.split(/\r?\n/u).length; }
	/** Responsibilities: _readability check_. **/
	public readable(): boolean { return this.content.trim().length > 0; }
	/** Responsibilities: _content summary_. **/
	public summary(): string {
		const words = this.word_count();
		return `${words} words in ${this.line_count()} lines`;
	}
}
// File: cli.ts
import { ContentRecord } from "src/content_record";
(function () {
	const record = new ContentRecord("hello world");
	console.log(record.readable(), record.summary());
})();
```
