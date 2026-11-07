# `duplicate-error-translation`

Description: Reports a production `catch` or `except` handler that constructs the identical
error translation more than once. Preserve meaningful differences in error
category or context; merge paths that produce the same result.

## Bad

```ts
// File: src/document_archive.ts
/** Responsibilities: _document content_, _error context_. **/
export class DocumentArchive {
	private readonly raw_text: string;
	private source_value(): string {
		const source = this.raw_text.trim();
		if (source.length === 0) { throw new SyntaxError("Empty document."); }
		return source;
	}
	/** Responsibilities: _archive initialization_. **/
	public constructor(raw_text: string) {
		this.raw_text = raw_text;
	}
	/** Responsibilities: _document content access_. **/
	public contents(): string {
		try {
			const source = this.source_value();
			return source.toUpperCase();
		} catch (error) {
			const rendered_error = String(error);
			if (rendered_error.startsWith("SyntaxError")) {
				throw new Error("Document content is invalid.");
			}
			if (rendered_error.startsWith("TypeError")) {
				throw new Error("Document content is invalid."); // <- error
			}
			throw error;
		}
	}
	/** Responsibilities: _archive report output_. **/
	public report(): void {
		console.log(`Document: ${this.contents()}`);
	}
}
// File: cli.ts
import { DocumentArchive } from "src/document_archive";

(() => {
	const archive = new DocumentArchive("ready");
	archive.report();
})();
```


## Good

```ts
// File: src/document_archive.ts
/** Responsibilities: _document content_, _error context_. **/
export class DocumentArchive {
	private readonly _raw_text: string;
	private source_value(): string {
		const source = this._raw_text.trim();
		if (this._raw_text.trim().length === 0) { throw new SyntaxError("Empty document."); }
		return source;
	}
	/** Responsibilities: _archive initialization_. **/
	public constructor(raw_text: string) {
		this._raw_text = raw_text;
	}
	/** Responsibilities: _document content access_. **/
	public contents(): string {
		const source = this.source_value();
		return source.toUpperCase();
	}
	/** Responsibilities: _archive report output_. **/
	public report(): void {
		console.log(`Document: ${this.contents()}`);
	}
}
// File: cli.ts
import { DocumentArchive } from "src/document_archive";

(() => {
	const archive = new DocumentArchive("ready");
	archive.report();
})();
```

