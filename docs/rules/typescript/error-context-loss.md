# error-context-loss

Description: Reports only explicit exception-context suppression:

- TypeScript catches a named error and throws a new `*Error` without using the
  caught error, its message, or a `cause` property.
- Python uses `raise ... from None` inside an exception handler.

Rethrowing the original error, passing it to the new error, and ordinary
boundary translation remain allowed.

## Bad

```ts
// File: src/document_parser.ts
/** Responsibilities: _document parsing_. **/
export class DocumentParser {
	private readonly source_text: string;
	/** Responsibilities: _parser initialization_. **/
	public constructor(source_text: string) {
		this.source_text = source_text;
	}
	/** Responsibilities: _source decoding_. **/
	private decode_document(): string {
		if (this.source_text.trim().length === 0) { throw new Error("Document is empty"); }
		return this.source_text.trim();
	}
	/** Responsibilities: _document error translation_. **/
	public parse_document(): string {
		try {
			return this.decode_document();
		} catch (error) {
			throw new Error("Invalid document"); // <- error
		}
	}
	/** Responsibilities: _parse status output_. **/
	public report(): void {
		console.log(`Parsed: ${this.parse_document()}`);
	}
}
// File: cli.ts
import { DocumentParser } from "src/document_parser";

(() => {
	const parser = new DocumentParser("valid document");
	parser.report();
})();
```


## Good

```ts
// File: src/document_record.ts
/** Responsibilities: _document parsing_. **/
export class DocumentRecord {
	private readonly _source_text: string;
	/** Responsibilities: _record initialization_. **/
	public constructor(source_text: string) {
		this._source_text = source_text;
	}
	/** Responsibilities: _document error translation_. **/
	public content_text(): string {
		const normalized_text = this._source_text.trim();
		if (this._source_text.trim().length === 0) { throw new Error("Document is empty"); }
		return normalized_text;
	}
	/** Responsibilities: _document character measurement_. **/
	public document_length(): number {
		const normalized_text = this.content_text();
		let character_count = 0;
		for (const character of normalized_text) {
			if (character.trim().length > 0) { character_count += 1; }
		}
		return character_count;
	}
	/** Responsibilities: _document word measurement_. **/
	public word_count(): number {
		const normalized_text = this.content_text();
		const words = normalized_text.split(/\s+/u);
		let count = 0;
		for (const word of words) {
			if (word.length > 0) { count += 1; }
		}
		return count;
	}
	/** Responsibilities: _parse status output_. **/
	public report(): void {
		const content = this.content_text();
		const character_count = this.document_length();
		const word_count = this.word_count();
		const summary = `Parsed: ${content}`;
		const metrics = `${character_count} characters, ${word_count} words`;
		console.log(`${summary} (${metrics})`);
	}
}
// File: cli.ts
import { DocumentRecord } from "src/document_record";

(() => {
	const document = new DocumentRecord("valid document");
	document.report();
})();
```

