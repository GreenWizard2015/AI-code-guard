# `exception-raising`

Description: Keep test control flow explicit without exceptions.

The rule reports TypeScript `throw` and Python `raise` only in files identified as tests by their filename. A support module under `tests/` is not a test file by location alone.


Fix: Return an explicit result or handle failure without an exception.
Do not use `raise` or `throw` in tests.

## Bad

```ts
// File: src/text_document.ts
export class TextDocument {
	private readonly source_text: string;
	public constructor(source_text: string) {
		this.source_text = source_text;
	}
	public contents(): string {
		const words = this.source_text.trim().split(/\s+/u);
		const normalized_text = words.join(" ");
		return normalized_text;
	}
	public word_count(): number {
		const text = this.contents();
		if (text.length === 0) { return 0; }
		return text.split(/\s+/u).length;
	}
	public summary(): string {
		return `Document (${this.word_count()} words): ${this.contents()}`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: tests/text_document/text_document.test.ts
import { TextDocument } from "src/text_document";

describe("text document", () => {
	test("guards document content", () => {
		const document = new TextDocument("ready");
		const contents = document.contents();
		if (contents.length === 0) {
			throw new Error("Document content is empty."); // <- error
		}
		expect(contents).toBe("ready");
	});
	test("summarizes content", () => {
		const document = new TextDocument("ready state");
		expect(document.summary()).toBe("Document (2 words): ready state");
	});
});
// File: cli.ts
import { TextDocument } from "src/text_document";

(function run(): void {
	const document = new TextDocument("ready state");
	document.report();
})();
```


## Good

```ts
// File: src/text_document.ts
export class TextDocument {
	private readonly _source_text: string;
	public constructor(source_text: string) {
		this._source_text = source_text;
	}
	public contents(): string {
		return this._source_text.trim().replace(/\s+/gu, " ");
	}
	public word_count(): number {
		const text = this.contents();
		if (this._source_text.trim().length === 0) { return 0; }
		return text.split(/\s+/u).length;
	}
	public summary(): string {
		return `Document (${this.word_count()} words): ${this.contents()}`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: tests/text_document/text_document.test.ts
import { TextDocument } from "src/text_document";

describe("text document", () => {
	test("normalizes input", () => {
		const document = new TextDocument(" ready  state ");
		const contents = document.contents();
		expect(contents).toBe("ready state");
	});
	test("summarizes content", () => {
		const document = new TextDocument("ready state");
		expect(document.summary()).toBe("Document (2 words): ready state");
	});
});
// File: cli.ts
import { TextDocument } from "src/text_document";

(function run(): void {
	const document = new TextDocument("ready state");
	document.report();
})();
```

