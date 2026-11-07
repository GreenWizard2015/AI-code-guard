# `boolean-is-name`

Description: Review boolean methods beginning with `is*`. Prefer an adjective when it reads
naturally: `isEmpty()` → `empty()`, `isReadable()` → `readable()`, and
`isNegative()` → `negative()`.

## Bad

```ts
// File: src/file_entry.ts
export class FileEntry {
	private readonly path: string;
	private readonly content: string;
	/** Responsibilities: _entry initialization_. **/
	public constructor(path: string, content: string) {
		this.path = path;
		this.content = content;
	}
	/** Responsibilities: _file name extraction_. **/
	public display_name(): string {
		return this.path.slice(this.path.lastIndexOf("/") + 1);
	}
	/** Responsibilities: _word counting_. **/
	public word_count(): number {
		const content = this.content.trim();
		if (content.length === 0) { return 0; }
		return content.split(/\s+/u).length;
	}
	public is_empty(): boolean { // <- error
		return this.content.length === 0;
	}
	public content_summary(): string {
		return `${this.display_name()} (${this.word_count()} words)`;
	}
	public report(): void {
		console.log(`${this.display_name()} ${this.word_count()} ${this.is_empty()} ${this.content_summary()}`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { FileEntry } from "src/file_entry";

(() => {
	const entry = new FileEntry("notes.txt", "hello");
	entry.report();
})();
```


## Good

The only change is the predicate's name; its result and all other behavior are preserved.

```ts
// File: src/file_entry.ts
/** Responsibilities: _file entry state_. **/
export class FileEntry {
	private readonly _path: string;
	private readonly _content: string;
	/** Responsibilities: _entry initialization_. **/
	public constructor(path: string, content: string) {
		this._path = path;
		this._content = content;
	}
	/** Responsibilities: _file name extraction_. **/
	public display_name(): string {
		return this._path.slice(this._path.lastIndexOf("/") + 1);
	}
	/** Responsibilities: _word counting_. **/
	public word_count(): number {
		const content = this._content.trim();
		if (content.length === 0) { return 0; }
		return content.split(/\s+/u).length;
	}
	/** Responsibilities: _empty content classification_. **/
	public empty(): boolean {
		return this._content.length === 0;
	}
	/** Responsibilities: _content summary formatting_. **/
	public content_summary(): string {
		return `${this.display_name()} (${this.word_count()} words)`;
	}
	/** Responsibilities: _file entry report output_. **/
	public report(): void {
		console.log(`${this.display_name()} ${this.word_count()} ${this.empty()} ${this.content_summary()}`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { FileEntry } from "src/file_entry";

(() => {
	const entry = new FileEntry("notes.txt", "hello");
	entry.report();
})();
```

