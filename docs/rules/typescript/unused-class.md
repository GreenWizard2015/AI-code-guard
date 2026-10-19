# `unused-class`

Description: Reports a production implementation class with no production symbol usage.
Tests do not count as production usage. Entry-point files and protocol/type-contract
classes are excluded.

## Bad

```ts
// File: src/message_text.ts
export class MessageText {} // <- error
```


## Good

```ts
export class Message {
	private readonly content: string;
	/** Responsibilities: _message initialization_. **/
	public constructor(content: string) { this.content = content; }
	/** Responsibilities: _normalized message text_. **/
	public normalized_text(): string {
		const trimmed = this.content.trim();
		return trimmed.replace(/\s+/gu, " " );
	}
	/** Responsibilities: _message word count_. **/
	public word_count(): number {
		const text = this.normalized_text();
		if (text.length === 0) { return 0; }
		return text.split(/\s+/u).length;
	}
	/** Responsibilities: _empty message classification_. **/
	public empty(): boolean { return this.content.length === 0; }
	/** Responsibilities: _message fragment search_. **/
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim();
		return this.normalized_text().includes(normalized_fragment);
	}
	/** Responsibilities: _uppercase message text_. **/
	public uppercase_text(): string { return this.normalized_text().toUpperCase(); }
}
// File: cli.ts
#!/usr/bin/env node
import { Message } from "src/documentation/test-production-usage/message";
(function () {
	const message = new Message("cli payload");
	console.log(message.normalized_text(), message.word_count(), message.empty(), message.contains("cli"), message.uppercase_text());
})();
```

