# callable-nesting-depth

Description: Problem: callable control-flow nesting is too deep.

Hint: Split nested control flow into focused predicates or operations. Do not:
hide the nesting in arbitrary wrappers.

The rule counts nested `if`, loops, `try`, `with`, `match`, and `switch`
containers inside one callable. Nested callable bodies are separate scopes and
do not increase the enclosing callable's depth. The same metric is collected
for TypeScript and Python callables, including methods.

## Bad

```ts
// File: src/types.ts
export type SourceItem = { visible: boolean; value: string };
// File: src/content_source.ts
import type { SourceItem } from "src/types";

export class ContentSource {
	private readonly enabled: boolean;
	private readonly items: readonly SourceItem[];
	public constructor(enabled: boolean, items: readonly SourceItem[]) {
		this.enabled = enabled;
		this.items = items;
	}
	public read_ready_value(): string { // <- error
		if (this.enabled) {
			for (const item of this.items) {
				if (item.visible) {
					try {
						return item.value;
					} catch {
						continue;
					}
				}
			}
		}
		return "";
	}
	public report(): void {
		console.log(`Ready value: ${this.read_ready_value()}`);
	}
}
// File: cli.ts
import { ContentSource } from "src/content_source";

(() => {
	const source = new ContentSource(true, [{ visible: true, value: "ready" }]);
	source.report();
})();
```


## Good

```ts
// File: src/content_source.ts
/** Responsibilities: _content source state_. **/
export class ContentSource {
	private readonly _content: string;
	private readonly _path: string;

	/** Responsibilities: _source initialization_. **/
	public constructor(content: string, path: string) {
		this._content = content;
		this._path = path;
	}

	/** Responsibilities: _ready value selection_. **/
	public value_when_ready(): string {
		const normalized_content = this._content.trim();
		if (this._content.trim().length === 0) {
			return "";
		}
		return normalized_content;
	}

	/** Responsibilities: _file label composition_. **/
	public file_name(): string {
		const separator = this._path.lastIndexOf("/");
		return this._path.slice(separator + 1);
	}

	/** Responsibilities: _word count_. **/
	public word_count(): number {
		const normalized_content = this._content.trim();
		const words = normalized_content.split(/\s+/u);
		return words.length;
	}

	/** Responsibilities: _source summary_. **/
	public summary(): string {
		const count = this.word_count();
		return `${this.file_name()} (${count} words)`;
	}

	/** Responsibilities: _source report output_. **/
	public report(): void {
		console.log(`${this.value_when_ready()} | ${this.summary()}`);
	}
}
// File: cli.ts
import { ContentSource } from "src/content_source";

(() => {
	const source = new ContentSource("  ready value  ", "notes.txt");
	source.report();
})();
```
