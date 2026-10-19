# `callable-min-size`

Description: Detect functions and methods whose implementation is too small to own meaningful
behavior.


Fix: Inline a short forwarding operation, move behavior to its caller, or replace the indirection
with a focused module function. Do not add padding or wrappers only to satisfy the rule.

Size averages callable-body lines and executable SLOC, excluding signatures and Python docstrings.
The separate 100-significant-character limit ignores whitespace; do not pad code to satisfy either.

## Bad

```ts
// File: src/content_record.ts
export class ContentRecord {
	private readonly name: string;
	private readonly content: string;

	public constructor(name: string, content: string) {
		this.name = name;
		this.content = content;
	}

	private content_label(): string {
		return `${this.name}: ${this.content}`;
	}

	public summary(): string {
		const label = this.content_label();
		const count = this.word_count();
		return `${label} (${count} words)`;
	}

	public word_count(): number {
		const words = this.content.trim().split(/\s+/u);
		return words.length;
	}
}
// File: cli.ts
import { ContentRecord } from "src/content_record";
(function () {
	const record = new ContentRecord("notes.txt", "ready value");
	const summary = record.summary();
	console.log(summary);
})();
```

## Good

```ts
// File: src/content_record.ts
/** Responsibilities: _content record state_. **/
export class ContentRecord {
	private readonly name: string;
	private readonly content: string;

	/** Responsibilities: _record initialization_. **/
	public constructor(name: string, content: string) {
		this.name = name;
		this.content = content;
	}

	/** Responsibilities: _word count_. **/
	public word_count(): number {
		const normalized = this.content.trim();
		const words = normalized.split(/\s+/u);
		return words.length;
	}

	/** Responsibilities: _content label_. **/
	public content_label(): string {
		return `${this.name}: ${this.content}`;
	}

	/** Responsibilities: _record summary_. **/
	public summary(): string {
		const label = this.content_label();
		const count = this.word_count();
		return `${label} (${count} words)`;
	}
}
// File: cli.ts
import { ContentRecord } from "src/content_record";
(function () {
	const record = new ContentRecord("notes.txt", "ready value");
	const label = record.content_label();
	const count = record.word_count();
	console.log(label, count, record.summary());
})();
```
