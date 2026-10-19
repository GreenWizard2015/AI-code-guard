# `getattr`

Description: Dynamic attribute lookup used for ordinary control flow hides the object's
contract. Prefer a declared field or named method for known project data.

## Bad

```ts
// File: cli.ts
(function () {
	const name = getattr(item, "name");
	console.log(name);
})();
```


## Good

```ts
// File: src/file_entry.ts
/** Responsibilities: _file entry state_. **/
export class FileEntry {
	public readonly path: string;
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
		const content = this.content.trim();
		if (content.length === 0) {
			return 0;
		}
		return content.split(/\s+/u).length;
	}

	/** Responsibilities: _content readability classification_. **/
	public readable(): boolean {
		return this.content.trim().length > 0;
	}

	/** Responsibilities: _entry summary_. **/
	public content_summary(): string {
		return `${this.file_name()} (${this.word_count()} words)`;
	}
}
// File: cli.ts
import { FileEntry } from "src/file_entry";

(function () {
	const entry = new FileEntry("notes.txt", "hello world");
	console.log(entry.path);
	console.log(entry.file_name());
	console.log(entry.word_count());
	console.log(entry.readable());
	console.log(entry.content_summary());
})();
```
