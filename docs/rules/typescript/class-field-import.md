# `class-field-import`

Description: Do not assign an imported function directly to a class field. Inject a
collaborator or put the operation behind a method owned by the class.

## Bad

```ts
// File: src/query_normalizer.ts
import { normalize_text } from "src/text_functions";

export class QueryNormalizer {
	public readonly normalize = normalize_text;
	public report(): void {
		const normalized = this.normalize("  ready  ");
		console.log(`Query: ${normalized}`);
	}
}
// File: src/text_functions.ts
export function normalize_text(value: string): string {
	return value.trim();
}
// File: cli.ts
import { QueryNormalizer } from "src/query_normalizer";
(function () {
	const normalizer = new QueryNormalizer();
	normalizer.report();
})();
```


## Good

```ts
// File: src/query_normalizer.ts
/** Responsibilities: _text normalization state_. **/
export class QueryNormalizer {
	private readonly _separator: string;

	/** Responsibilities: _normalization initialization_. **/
	public constructor(separator: string) {
		this._separator = separator;
	}

	/** Responsibilities: _text normalization_. **/
	public normalize_query(query: string): string {
		const normalized = query.trim();
		if (this._separator.length === 0) {
			return normalized;
		}
		return normalized.replace(/\s+/gu, this._separator);
	}

	/** Responsibilities: _display label composition_. **/
	public display_query(label: string): string {
		const normalized = this.normalize_query(label);
		return `[${normalized}]`;
	}

	/** Responsibilities: _word count_. **/
	public query_word_count(source: string): number {
		const normalized = this.normalize_query(source);
		return normalized.split(this._separator).length;
	}

	public report(): void {
		const normalized = this.normalize_query(" fresh query ");
		const display = this.display_query("restricted");
		const count = this.query_word_count("publish report");
		console.log(`${normalized} ${display} ${count}`);
	}
}
// File: cli.ts
import { QueryNormalizer } from "src/query_normalizer";

(function () {
	const normalizer = new QueryNormalizer(" ");
	normalizer.report();
})();
```
