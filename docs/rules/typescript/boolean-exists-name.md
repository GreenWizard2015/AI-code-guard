# `boolean-exists-name`

Description: Prefer `present()` over boolean `exists()` when it expresses the same contract.

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
		return this.path.slice(this.path.lastIndexOf("/") + 1);
	}

	public word_count(): number {
		const trimmed_content = this.content.trim();
		const words = trimmed_content.split(/\s+/u);
		return words.length;
	}

	public exists(): boolean { // <- error
		return this.content.length > 0;
	}

	public content_summary(): string {
		const label = this.file_name();
		const words = this.word_count();
		return `${label} (${words} words)`;
	}

	public report(): void {
		const label = this.file_name();
		const words = this.word_count();
		const exists = this.exists();
		const summary = this.content_summary();
		console.log(`${label}: ${words} words, exists=${exists}, ${summary}`);
	}
}
// File: cli.ts
import { FileEntry } from "src/file_entry";

(function run(): void {
	const entry = new FileEntry("notes.txt", "hello world");
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
		return this._path.slice(this._path.lastIndexOf("/") + 1);
	}

	/** Responsibilities: _word count_. **/
	public word_count(): number {
		const trimmed_content = this._content.trim();
		const words = trimmed_content.split(/\s+/u);
		return words.length;
	}

	/** Responsibilities: _content presence classification_. **/
	public present(): boolean {
		return this._content.length > 0;
	}

	/** Responsibilities: _entry summary_. **/
	public content_summary(): string {
		const label = this.file_name();
		const words = this.word_count();
		return `${label} (${words} words)`;
	}

	/** Responsibilities: _entry reporting_. **/
	public report(): void {
		const label = this.file_name();
		const words = this.word_count();
		const is_present = this.present();
		const summary = this.content_summary();
		console.log(`${label}: ${words} words, present=${is_present}, ${summary}`);
	}
}
// File: cli.ts
import { FileEntry } from "src/file_entry";

(function run(): void {
	const entry = new FileEntry("notes.txt", "hello world");
	entry.report();
})();
```
