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

	test("parses a value directly", () => {
		const parser = new MessageParser();
		expect(parser.parse("world")).toBe("world");
	});
});
// File: src/documentation/test-production-usage/output.ts
export class OutputReporter {
	public write(message: string): void {
		console.log(message);
	}
}
// File: src/cli.ts
import { MessageParser } from "src/documentation/test-production-usage/message_parser";
import { OutputReporter } from "src/documentation/test-production-usage/output";
(function () {
	const parser = new MessageParser();
	const parsed_message = parser.parse("hello");
	const reporter = new OutputReporter();
	reporter.write(parsed_message);
})();
```

## Good

```ts
// File: src/documentation/test-production-usage/message.ts
export class Message {
	private readonly _normalized_cache: Map<string, string>;
	private readonly _content: string;
	public constructor(content: string) {
		this._content = content;
		this._normalized_cache = new Map();
	}
	public normalized_text(): string {
		const cached = this._normalized_cache.get(this._content);
		if (cached !== undefined) { return cached; }
		const normalized = this._content.trim().replace(/\s+/gu, " ");
		this._normalized_cache.set(this._content, normalized);
		return normalized;
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
	public empty(): boolean {
		const normalized = this.normalized_text();
		if (normalized.length === 0) {
			return true;
		}
		return this.word_count() === 0;
	}
	public report(): void {
		const fields = [
			this.normalized_text(),
			String(this.word_count()),
			String(this.empty()),
		];
		console.log(fields.join(" | "));
	}
}
// File: tests/documentation/test-production-usage/message.test.ts
import { Message } from "src/documentation/test-production-usage/message";
describe("Message", () => {
	test("normalizes message text", () => {
		const message = new Message(" hello   world ");
		expect(message.normalized_text()).toBe("hello world");
	});
	test("counts message words", () => {
		const message = new Message(" hello   world ");
		expect(message.word_count()).toBe(2);
	});
	test("classifies a nonempty message", () => {
		const message = new Message(" hello   world ");
		expect(message.empty()).toBe(false);
	});
});
// File: src/cli.ts
#!/usr/bin/env node
import { Message } from "src/documentation/test-production-usage/message";
(function () {
	const message = new Message("cli payload");
	message.report();
})();
```
