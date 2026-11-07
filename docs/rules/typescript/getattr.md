# `getattr`

Description: Dynamic attribute lookup used for ordinary control flow hides the object's
contract. Prefer a declared field or named method for known project data.

## Bad

```ts
// File: src/item_record.ts
export class ItemRecord {
	public readonly name: string;
	public readonly category: string;
	public constructor(name: string, category: string) {
		this.name = name;
		this.category = category;
	}
	public label(): string { return `${this.name}: ${this.category}`; }
}
// File: src/attribute_reader.ts
import { ItemRecord } from "src/item_record";
function getattr(item: ItemRecord, key: string): string {
	if (key === "name") { return item.name; }
	return "unknown";
}
export class ItemReporter {
	private readonly item: ItemRecord;
	public constructor(item: ItemRecord) { this.item = item; }
	public display_name(): string { return getattr(this.item, "name"); }
	public report(): void { console.log(`${this.item.label()} (${this.display_name()})`); }
}
// File: cli.ts
import { ItemRecord } from "src/item_record";
import { ItemReporter } from "src/attribute_reader";
(function () {
	const item = new ItemRecord("Atlas", "map");
	const reporter = new ItemReporter(item);
	reporter.report();
})();
```


## Good

```ts
// File: src/file_entry.ts
/** Responsibilities: _file entry state_. **/
export class FileEntry {
	public readonly _path: string;
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
	/** Responsibilities: _readability label_. **/
	public readability_label(): string {
		if (this.readable()) { return "readable"; }
		return "empty";
	}
	/** Responsibilities: _entry report_. **/
	public report(): void {
		console.log(`${this.content_summary()}: ${this.readability_label()}`);
	}
}
// File: cli.ts
import { FileEntry } from "src/file_entry";

(function () {
	const entry = new FileEntry("notes.txt", "hello world");
	entry.report();
})();
```
