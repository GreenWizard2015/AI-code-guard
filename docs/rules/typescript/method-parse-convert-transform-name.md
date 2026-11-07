# `method-parse-convert-transform-name`

Description: Review public non-boolean result methods beginning with `parse*`, `convert*`,
or `transform*`. These names can expose a procedural `data → operation → data`
pipeline. Prefer the representation or value object: `parseJson()` → `json()`
or `ParsedJson`, `convertImage()` → `PngImage`.

## Bad

```ts
// File: src/document_text.ts
export class DocumentText {
	private readonly raw_document: string;

	public constructor(raw_document: string) {
		this.raw_document = raw_document;
	}

	public parse_document(): string { // <- error
		const words = this.raw_document.trim().split(/\s+/u);
		return words.join(" ");
	}

	public word_count(): number {
		const normalized = this.parse_document();
		return normalized.split(" ").length;
	}

	public summary(): string {
		const document = this.parse_document();
		const count = this.word_count();
		return `${count} words: ${document}`;
	}

	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { DocumentText } from "src/document_text";

(function run(): void {
	const document = new DocumentText("ready document");
	document.report();
})();
```


## Good

```ts
// File: src/document_text.ts
/** Responsibilities: _document text representation_, _word measurement_. **/
export class DocumentText {
	private readonly _raw_document: string;

	/** Responsibilities: _document initialization_. **/
	public constructor(raw_document: string) {
		this._raw_document = raw_document;
	}

	/** Responsibilities: _document text representation_. **/
	public document_text(): string {
		if (this._raw_document.trim().length === 0) {
			return "";
		}
		const parts = this._raw_document.trim().split(/\s+/u);
		const normalized_parts: string[] = [];
		for (const part of parts) {
			if (part.length > 0) {
				normalized_parts.push(part);
			}
		}
		return normalized_parts.join(" ");
	}

	/** Responsibilities: _word count_. **/
	public word_count(): number {
		const text = this.document_text();
		let count = 0;
		for (const word of text.split(/\s+/u)) {
			if (word.length > 0) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _document summary_. **/
	public summary(): string {
		const text = this.document_text();
		const count = this.word_count();
		return `${count} words: ${text}`;
	}

	/** Responsibilities: _document report output_. **/
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { DocumentText } from "src/document_text";

(function run(): void {
	const document = new DocumentText("ready document");
	document.report();
})();
```
