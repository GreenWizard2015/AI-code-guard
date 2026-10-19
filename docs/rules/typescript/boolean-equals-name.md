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
}
// File: cli.ts
import { FileEntry } from "src/file_entry";
(function () {
	const entry = new FileEntry("notes.txt", "hello");
	const label = entry.file_name();
	const words = entry.word_count();
	console.log(label, words, entry.equals("hello world"));
})();
```

## Good

```ts
// File: src/file_entry.ts
/** Responsibilities: _file entry state_. **/
export class FileEntry {
	private readonly path: string;
	private readonly content: string;

	/** Responsibilities: _file entry initialization_. **/
	public constructor(path: string, content: string) {
		this.path = path;
		this.content = content;
	}

	/** Responsibilities: _file label composition_. **/
	public file_name(): string {
		const separator = this.path.lastIndexOf("/");
		return this.path.slice(separator + 1);
	}

	/** Responsibilities: _word count_. **/
	public word_count(): number {
		const trimmed_content = this.content.trim();
		const words = trimmed_content.split(/\s+/u);
		return words.length;
	}

	/** Responsibilities: _content equivalence_. **/
	public equal_to(other_content: string): boolean {
		const normalized_content = this.content.trim().replace(/\s+/gu, " ");
		return normalized_content === other_content;
	}
}
// File: cli.ts
import { FileEntry } from "src/file_entry";
(function () {
	const entry = new FileEntry("notes.txt", "hello");
	const label = entry.file_name();
	const words = entry.word_count();
	console.log(label, words, entry.equal_to("hello world"));
})();
```
