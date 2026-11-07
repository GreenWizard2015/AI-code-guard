# `unused-callable`

Description: Remove or refactor production callables that have no meaningful production consumers.

## Bad

```ts
// File: src/message_text.ts
export class MessageText {
	private readonly value_text: string;
	public constructor(value_text: string) { this.value_text = value_text; }
	public normalized_text(): string {
		return this.value_text.trim().split(/\s+/u).join(" ");
	}
	public word_count(): number {
		const normalized = this.normalized_text();
		if (normalized.length === 0) {
			return 0;
		}
		return normalized.split(" ").length;
	}
	public uppercase_text(): string { return this.normalized_text().toUpperCase(); } // <- error
	public report(): void {
		const normalized = this.normalized_text();
		const count = this.word_count();
		const uppercase = normalized.toUpperCase();
		console.log(`${normalized} | ${count} | ${uppercase}`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { MessageText } from "src/message_text";

(function run(): void {
	const message = new MessageText("  cli   payload ");
	message.report();
})();
```


## Good

```ts
// File: src/message.ts
export class Message {
	private readonly _content: string;
	public constructor(content: string) {
		this._content = content;
	}
	public normalized_text(): string {
		const trimmed_content = this._content.trim();
		if (this._content.trim().length === 0) {
			return "";
		}
		const words = trimmed_content.split(/\s+/u);
		const normalized_words: string[] = [];
		for (const word of words) {
			if (word.length > 0) {
				normalized_words.push(word);
			}
		}
		return normalized_words.join(" ");
	}
	public word_count(): number {
		const normalized = this.normalized_text();
		if (normalized.length === 0) {
			return 0;
		}
		const words = normalized.split(" ");
		let count = 0;
		for (const word of words) {
			if (word.length > 0) {
				count += 1;
			}
		}
		return count;
	}
	public uppercase_text(): string {
		const normalized = this.normalized_text();
		return normalized.toUpperCase();
	}
	public report(): void {
		const normalized = this.normalized_text();
		const count = this.word_count();
		const uppercase = this.uppercase_text();
		const fields = [normalized, String(count), uppercase];
		const report_line = fields.join(" | ");
		console.log(report_line);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { Message } from "src/message";

(function run(): void {
	const message = new Message("  cli   payload ");
	message.report();
})();
```

