# `class-field-import`

Description: Do not assign an imported function directly to a class field. Inject a
collaborator or put the operation behind a method owned by the class.

## Bad

```ts
// File: src/query_normalizer.ts
import { normalize_text } from "src/text_functions";

export class QueryNormalizer {
	public readonly normalize = normalize_text;
}
// File: src/text_functions.ts
export function normalize_text(value: string): string {
	return value.trim();
}
```


## Good

```ts
// File: src/query_normalizer.ts
/** Responsibilities: _text normalization state_. **/
export class QueryNormalizer {
	private readonly separator: string;

	/** Responsibilities: _normalization initialization_. **/
	public constructor(separator: string) {
		this.separator = separator;
	}

	/** Responsibilities: _text normalization_. **/
	public normalize_query(query: string): string {
		const normalized = query.trim();
		return normalized.replace(/\s+/gu, this.separator);
	}

	/** Responsibilities: _display label composition_. **/
	public display_query(query: string): string {
		const normalized = this.normalize_query(query);
		return `[${normalized}]`;
	}

	/** Responsibilities: _word count_. **/
	public query_word_count(query: string): number {
		const normalized = this.normalize_query(query);
		return normalized.split(this.separator).length;
	}

	/** Responsibilities: _text capitalization_. **/
	public uppercase_query(query: string): string {
		const normalized = this.normalize_query(query);
		return normalized.toUpperCase();
	}
}
// File: cli.ts
import { QueryNormalizer } from "src/query_normalizer";

(function () {
	const normalizer = new QueryNormalizer(" ");
	const normalized = normalizer.normalize_query("  ready  ");
	const display = normalizer.display_query("blocked");
	const count = normalizer.query_word_count("ready to publish");
	const uppercase = normalizer.uppercase_query("ready");
	console.log(`${normalized} ${display} ${count} ${uppercase}`);
})();
```
