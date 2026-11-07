# `boolean-equals-name`

Description: Review boolean `equals()` methods. When the language protocol permits it, a
property-shaped name such as `equal_to()` better expresses the comparison.
Do not rename a required language equality protocol mechanically.

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

	public file_name(): string {
		const separator = this.path.lastIndexOf("/");
		return this.path.slice(separator + 1);
	}

	public word_count(): number {
		const trimmed_content = this.content.trim();
		const words = trimmed_content.split(/\s+/u);
		return words.length;
	}

	public equals(other_content: string): boolean {
		const normalized_content = this.content.trim().replace(/\s+/gu, " ");
		return normalized_content === other_content;
	}
	public report(): void {
		console.log(`${this.file_name()} ${this.word_count()} ${this.equals("hello world")}`);
	}
}
// File: cli.ts
import { FileEntry } from "src/file_entry";

(() => {
	const entry = new FileEntry("notes.txt", "hello");
	entry.report();
})();
```

## Good

```ts
// File: src/file_entry.ts
/** Responsibilities: _file entry state_. **/
export class FileEntry {
	private readonly _path: string;
	private readonly _content: string;

	/** Responsibilities: _file entry initialization_. **/
	public constructor(path: string, content: string) {
		this._path = path;
		this._content = content;
	}

	/** Responsibilities: _file label composition_. **/
	public file_name(): string {
		const separator = this._path.lastIndexOf("/");
		return this._path.slice(separator + 1);
	}

	/** Responsibilities: _word count_. **/
	public word_count(): number {
		const trimmed_content = this._content.trim();
		const words = trimmed_content.split(/\s+/u);
		return words.length;
	}

	/** Responsibilities: _content equivalence_. **/
	public equal_to(other_content: string): boolean {
		return this._content.trim().replace(/\s+/gu, " ") === other_content;
	}
	/** Responsibilities: _file entry report output_. **/
	public report(): void {
		console.log(`${this.file_name()} ${this.word_count()} ${this.equal_to("hello world")}`);
	}
}
// File: cli.ts
import { FileEntry } from "src/file_entry";

(() => {
	const entry = new FileEntry("notes.txt", "hello");
	entry.report();
})();
```
