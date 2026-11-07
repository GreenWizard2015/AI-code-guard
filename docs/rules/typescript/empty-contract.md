# `empty-contract`

Description: A naming-only interface or protocol adds indirection without defining a useful
behavior boundary. Keep at least one meaningful operation that consumers need.

## Bad

```ts
// File: src/protocols.ts
export interface RepositoryContract {}
// File: src/content_reader.ts
import { RepositoryContract } from "src/protocols";

/** Responsibilities: _content reading_. **/
export class ContentReader implements RepositoryContract {
	private readonly content: string;
	/** Responsibilities: _reader initialization_. **/
	public constructor(content: string) {
		this.content = content;
	}
	/** Responsibilities: _content normalization_. **/
	public normalized_content(): string {
		return this.content.trim();
	}
	/** Responsibilities: _content length_. **/
	public character_count(): number {
		return this.normalized_content().length;
	}
	/** Responsibilities: _content consumption_. **/
	public consume_content(): string {
		return `Read ${this.character_count()} characters: ${this.normalized_content()}`;
	}
	/** Responsibilities: _reader output_. **/
	public report(): void {
		console.log(this.consume_content());
	}
}
// File: cli.ts
import { ContentReader } from "src/content_reader";

(() => {
	const reader = new ContentReader(" useful content ");
	reader.report();
})();
```


## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _document content contract_. **/
export interface ContentDocumentContract {
	consume_content(): string;
}
// File: src/content_document.ts
import type { ContentDocumentContract } from "src/protocols";

/** Responsibilities: _document content processing_, _text measurement_. **/
export class ContentDocument implements ContentDocumentContract {
	private readonly _content: string;
	/** Responsibilities: _document initialization_. **/
	public constructor(content: string) {
		this._content = content;
	}
	/** Responsibilities: _content normalization_. **/
	public normalized_content(): string {
		const words = this._content.trim().split(/\s+/u);
		let normalized = "";
		for (const word of words) {
			if (word.length > 0) {
				if (normalized.length > 0) {
					normalized += " ";
				}
				normalized += word;
			}
		}
		return normalized;
	}
	/** Responsibilities: _content length_. **/
	public character_count(): number {
		let visible_characters = 0;
		for (const character of this._content) {
			if (!/\s/u.test(character)) {
				visible_characters += 1;
			}
		}
		return visible_characters;
	}
	/** Responsibilities: _content consumption_. **/
	public consume_content(): string {
		const normalized = this.normalized_content();
		const character_count = this.character_count();
		let word_count = 0;
		if (normalized.length > 0) {
			word_count = normalized.split(/\s+/u).length;
		}
		return `Read ${character_count} characters across ${word_count} words: ${normalized}`;
	}
	/** Responsibilities: _reader output_. **/
	public report(): void {
		const output = this.consume_content();
		console.log(output);
	}
}
// File: cli.ts
import { ContentDocument } from "src/content_document";

(() => {
	const document = new ContentDocument(" useful content ");
	document.report();
})();
```

