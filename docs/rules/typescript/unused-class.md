# `unused-class`

Description: Reports a production implementation class with no production symbol usage.
Tests do not count as production usage. Entry-point files and protocol/type-contract
classes are excluded.

## Bad

```ts
// File: src/message_text.ts
export const MESSAGE_SEPARATOR = " | ";

export class MessageText { // <- error
	private readonly content: string;

	public constructor(content: string) {
		this.content = content;
	}

	public normalized_text(): string {
		return this.content.trim().replace(/\s+/gu, " ");
	}

	public word_count(): number {
		const normalized_text = this.normalized_text();
		if (normalized_text.length === 0) {
			return 0;
		}
		return normalized_text.split(" ").length;
	}

	public text(): string {
		return this.normalized_text();
	}

	public report(): void {
		console.log(`${this.text()} (${this.word_count()} words)`);
	}
}
// File: src/status_reporter.ts
import { MESSAGE_SEPARATOR } from "src/message_text";
export class StatusReporter {
	private readonly status: string;

	public constructor(status: string) {
		this.status = status;
	}

	public text(): string {
		return `Status: ${this.status.trim().toLowerCase()}`;
	}

	public report(): void {
		console.log(`${MESSAGE_SEPARATOR}${this.text()}`);
	}
}
// File: cli.ts
import { StatusReporter } from "src/status_reporter";
(function () {
	const reporter = new StatusReporter("READY");
	reporter.report();
})();
```

## Good

```ts
// File: src/message_text.ts
export class MessageText {
	private readonly _content: string;
	public constructor(content: string) {
		this._content = content;
	}
	/** Responsibilities: _normalized message text_. **/
	public normalized_text(): string {
		const trimmed = this._content.trim();
		return trimmed.replace(/\s+/gu, " ");
	}
	public word_count(): number {
		const text = this.normalized_text();
		if (text.length === 0) {
			return 0;
		}
		return text.split(/\s+/u).length;
	}
	public nonempty(): boolean {
		return this._content.trim().length > 0;
	}
	public labeled_text(prefix: string): string {
		const label = prefix.trim();
		const content = this.normalized_text();
		return `${label}: ${content}`;
	}
}
// File: src/message_archive.ts
import { MessageText } from "src/message_text";

/** Responsibilities: _message archive reporting_. **/
export class MessageArchive {
	private readonly _messages: MessageText[];
	public constructor() {
		this._messages = [];
	}
	public record_content(content_text: string): void {
		const message = new MessageText(content_text);
		if (message.nonempty()) {
			this._messages.push(message);
		}
	}
	public message_count(): number {
		return this._messages.length;
	}
	public summary(): string {
		const message_summaries: string[] = [];
		for (const message of this._messages) {
			const word_count = message.word_count();
			message_summaries.push(`${message.labeled_text("Message")} (${word_count} words)`);
		}
		return `${this.message_count()} messages: ${message_summaries.join("; ")}`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
#!/usr/bin/env node
import { MessageArchive } from "src/message_archive";
(function () {
	const archive = new MessageArchive();
	archive.record_content("cli payload");
	archive.report();
})();
```

