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
	public constructor(path: string, content: string) {
		this.path = path;
		this.content = content;
	}
	public display_name(): string {
		return this.path.slice(this.path.lastIndexOf("/") + 1);
	}
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
}
// File: cli.ts
#!/usr/bin/env node
import { FileEntry } from "src/file_entry";
(function () {
	const entry = new FileEntry("notes.txt", "hello");
	console.log(entry.display_name(), entry.word_count(), entry.is_empty(), entry.content_summary());
})();
```


## Good

The only change is the predicate's name; its result and all other behavior are preserved.

```ts
// File: src/file_entry.ts
/** Responsibilities: _file entry state_. **/
export class FileEntry {
	private readonly path: string;
	private readonly content: string;
	public constructor(path: string, content: string) {
		this.path = path;
		this.content = content;
	}
	public display_name(): string {
		return this.path.slice(this.path.lastIndexOf("/") + 1);
	}
	public word_count(): number {
		const content = this.content.trim();
		if (content.length === 0) { return 0; }
		return content.split(/\s+/u).length;
	}
	public empty(): boolean {
		return this.content.length === 0;
	}
	public content_summary(): string {
		return `${this.display_name()} (${this.word_count()} words)`;
	}
}
// File: cli.ts
#!/usr/bin/env node
import { FileEntry } from "src/file_entry";
(function () {
	const entry = new FileEntry("notes.txt", "hello");
	console.log(entry.display_name(), entry.word_count(), entry.empty(), entry.content_summary());
})();
```

