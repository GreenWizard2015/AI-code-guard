# Test production usage

Description: Each test body must construct or call an imported production class or function and
assert its observable result. A setup hook, fixture, factory, or helper cannot do that work for the
test—even if it returns a real production object or result. Mock-only assertions do not count.

## Bad

```ts
// File: src/documentation/test-production-usage/message_parser.ts
export class MessageParser {
	public parse(text: string): string {
		return text;
	}
}
// File: tests/documentation/test-production-usage/message_parser.test.ts
import { MessageParser } from "src/documentation/test-production-usage/message_parser";

describe("MessageParser", () => {
	function parsed_message_fixture(): string {
		return new MessageParser().parse("hello");
	}

	test("uses a helper result", () => {
		expect(parsed_message_fixture()).toBe("hello");
	});

	test("asserts a constant instead", () => {
		expect("hello").toBe("hello");
	});
});
```

## Good

```ts
// File: src/documentation/test-production-usage/message.ts
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
// File: tests/documentation/test-production-usage/message.test.ts
import { Message } from "src/documentation/test-production-usage/message";
describe("Message", () => {
	test("normalizes the message", () => { const message = new Message(" hello   world "); const actual = message.normalized_text(); expect(actual).toBe("hello world"); });
	test("counts message words", () => { const message = new Message("two words"); const actual = message.word_count(); expect(actual).toBe(2); });
});
// File: cli.ts
#!/usr/bin/env node
import { Message } from "src/documentation/test-production-usage/message";
(function () {
	const message = new Message("cli payload");
	const text = message.normalized_text();
	const words = message.word_count();
	console.log(text, words, message.empty(), message.contains("cli"), message.uppercase_text());
})();
```
