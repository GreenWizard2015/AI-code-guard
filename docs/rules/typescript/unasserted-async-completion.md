# `unasserted-async-completion`

Description: Await asynchronous work in tests so the test observes completion and failures.
The rule reports a discarded call to a locally declared async function in a
test body, whether the promise is ignored directly or stored and discarded.
Production files and nested callbacks are outside its scope.

## Bad

```ts
// File: tests/completion/async_operation.test.ts
import { Label } from "src/label";
describe("async completion", () => {
	test("observes the local asynchronous operation", async () => {
		async function load_label(): Promise<string> {
			return new Label("label").text();
		}

		const pending = load_label();
		void pending; // <- error
		expect("label").toBe("label");
	});
	test("checks another result", () => { expect(2).toBe(2); });
});
// File: src/label.ts
/** Responsibilities: _label text_. **/
export class Label {
	private readonly value: string;
	public constructor(value: string) {
		this.value = value;
	}
	public text(): string {
		return this.value.trim();
	}
	public report(): void {
		console.log(this.text());
	}
}
// File: cli.ts
import { Label } from "src/label";
(function () {
	new Label("label").report();
})();
```

## Good

```ts
// File: tests/file_entry/async_file_entry.test.ts
import { FileEntry } from "src/file_entry";
describe("FileEntry", () => {
	test("awaits the entry operation", async () => {
		const entry = new FileEntry("notes.txt", "hello world");
		async function load_label(): Promise<string> {
			return entry.file_name();
		}

		const label = await load_label();
		expect(label).toBe("notes.txt");
	});

	test("awaits the content operation", async () => {
		const entry = new FileEntry("notes.txt", "hello world");
		const words = await Promise.resolve(entry.word_count());
		expect(words).toBe(2);
	});
	test("reports the entry summary", () => {
		const entry = new FileEntry("notes.txt", "hello world");
		expect({ summary: entry.print_summary(), readable: entry.readable() }).toEqual({
			summary: "notes.txt (2 words)",
			readable: true,
		});
	});
});
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
		const content = this._content.trim();
		if (content.length === 0) {
			return 0;
		}
		return content.split(/\s+/u).length;
	}

	/** Responsibilities: _content readability classification_. **/
	public readable(): boolean {
		return this._content.trim().length > 0;
	}

	/** Responsibilities: _entry summary_. **/
	public content_summary(): string {
		return `${this.file_name()} (${this.word_count()} words)`;
	}
	public print_summary(): string {
		const summary = this.content_summary();
		console.log(summary);
		return summary;
	}
}
// File: cli.ts
#!/usr/bin/env node
import { FileEntry } from "src/file_entry";
(function () {
	const entry = new FileEntry("guide.md", "dispatch text");
	if (entry.readable()) {
		entry.print_summary();
	}
})();
```
