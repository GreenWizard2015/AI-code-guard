# `unasserted-async-completion`

Description: Await asynchronous work in tests so the test observes completion and failures.
The rule reports a direct, standalone call to a locally declared async
function in a test body. Production files and nested callbacks are outside its
scope.

## Bad

```ts
// File: tests/completion/async-operation.test.ts
describe("async completion", () => {
	test("observes the local asynchronous operation", async () => {
		async function load_label(): Promise<string> { return "label"; }
		load_label(); // <- error
		expect("label").toBe("label");
	});
	test("checks another result", () => { expect(2).toBe(2); });
});
```

## Good

```ts
// File: tests/file_entry/async_file_entry.test.ts
import { FileEntry } from "src/file_entry";
describe("FileEntry", () => {
	test("awaits the entry operation", async () => {
		const entry = new FileEntry("notes.txt", "hello world");
		const label = await Promise.resolve(entry.file_name());
		expect(label).toBe("notes.txt");
	});

	test("awaits the content operation", async () => {
		const entry = new FileEntry("notes.txt", "hello world");
		const words = await Promise.resolve(entry.word_count());
		expect(words).toBe(2);
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
#!/usr/bin/env node
import { FileEntry } from "src/file_entry";
(function () {
	const entry = new FileEntry("guide.md", "dispatch text");
	console.log(entry.file_name(), entry.word_count(), entry.readable(), entry.content_summary());
})();
```
