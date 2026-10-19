# `fixture-complexity`

Description: Keep Jest and `unittest` lifecycle hooks within the ordinary callable-size limit.
Build only the shared data the tests use; move substantial reusable setup into a focused fixture.

## Bad

```ts
{% const documents = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey", "xray", "yankee"] %}
// File: tests/file_entry/file_entry.test.ts
import { FileEntry } from "src/file_entry";
const entries: FileEntry[] = [];
describe("FileEntry", () => {
	beforeEach(() => { // <- error
		entries.length = 0;
{%for document in documents %}
		entries.push(new FileEntry("{{document}}.txt", "{{document}} text"));
{% endfor %}
	});

	test("counts words", () => {
		let total_words = 0;
		for (const entry of entries) { total_words += entry.word_count(); }
		expect(total_words).toBe(50);
	});

	test("extracts the file name", () => {
		expect(entries[1].file_name()).toBe("bravo.txt");
	});
});
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
		const content = this.content.trim();
		return content.split(/\s+/u).filter(Boolean).length;
	}

	public readable(): boolean {
		return this.content.trim().length > 0;
	}

	public content_summary(): string {
		return `${this.file_name()} (${this.word_count()} words)`;
	}
}
```

## Good

```ts
// File: tests/file_entry/file_entry.test.ts
import { FileEntry } from "src/file_entry";
describe("FileEntry", () => {
	test("counts words in the content", () => {
		const entry = new FileEntry("notes.txt", "hello world");
		expect(entry.word_count()).toBe(2);
		expect(entry.readable()).toBe(true);
	});

	test("extracts the file name", () => {
		const entry = new FileEntry("docs/notes.txt", "hello");
		expect(entry.file_name()).toBe("notes.txt");
		expect(entry.content_summary()).toBe("notes.txt (1 words)");
	});
});
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
		const content = this.content.trim();
		return content.split(/\s+/u).filter(Boolean).length;
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
#!/usr/bin/env node
import { FileEntry } from "src/file_entry";
(function () {
	const entry = new FileEntry("guide.md", "dispatch text");
	console.log(entry.file_name(), entry.word_count(), entry.readable(), entry.content_summary());
})();
```
