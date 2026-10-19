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
function read_ready_value(source: Source): string {
	if (source.enabled) {
		for (const item of source.items) {
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
```


## Good

```ts
// File: src/content_source.ts
/** Responsibilities: _content source state_. **/
export class ContentSource {
	private readonly content: string;
	private readonly path: string;

	/** Responsibilities: _source initialization_. **/
	public constructor(content: string, path: string) {
		this.content = content;
		this.path = path;
	}

	/** Responsibilities: _ready value selection_. **/
	public value_when_ready(): string {
		const normalized_content = this.content.trim();
		if (normalized_content.length === 0) {
			return "";
		}
		return normalized_content;
	}

	/** Responsibilities: _file label composition_. **/
	public file_name(): string {
		const separator = this.path.lastIndexOf("/");
		return this.path.slice(separator + 1);
	}

	/** Responsibilities: _word count_. **/
	public word_count(): number {
		const normalized_content = this.content.trim();
		const words = normalized_content.split(/\s+/u);
		return words.length;
	}

	/** Responsibilities: _source summary_. **/
	public summary(): string {
		const count = this.word_count();
		return `${this.file_name()} (${count} words)`;
	}
}
// File: cli.ts
import { ContentSource } from "src/content_source";

(function () {
	const source = new ContentSource("  ready value  ", "notes.txt");
	const ready_value = source.value_when_ready();
	const label = source.file_name();
	const count = source.word_count();
	const summary = source.summary();
	console.log(`${ready_value} ${label} ${count} ${summary}`);
})();
```
