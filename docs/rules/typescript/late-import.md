# `late-import`

Description: Keep static imports at the beginning of the file after the module docstring and future imports.

## Bad

```ts
// File: src/protocols.ts
export interface MessageContract {
	normalized_text(): string;
	word_count(): number;
	character_count(): number;
	summary(): string;
}
// File: src/message.ts
import type { MessageContract } from "src/protocols";
export class Message implements MessageContract {
	private readonly text: string;
	public constructor(text: string) {
		this.text = text;
	}
	public normalized_text(): string {
		return this.text.trim().toUpperCase();
	}
	public word_count(): number {
		return this.normalized_text().split(/\s+/u).filter((word) => word.length > 0).length;
	}
	public character_count(): number {
		return this.normalized_text().replace(/\s/gu, "").length;
	}
	public summary(): string {
		const text = this.normalized_text();
		const separator = text.indexOf(" ");
		let first_word = text;
		if (separator >= 0) { first_word = text.slice(0, separator); }
		return `${first_word} | ${this.word_count()} words, ${this.character_count()} characters`;
	}
}
// File: src/message_status.ts
export class MessageStatus {
	private readonly message: MessageContract;
	private status_line(): string {
		const text = this.message.normalized_text();
		if (text.length === 0) { return "UNAVAILABLE"; }
		return `Status: ${text}`;
	}
	public constructor(message: MessageContract) {
		this.message = message;
	}
	public reportable(): boolean {
		return this.message.word_count() > 0;
	}
	public summary(): string {
		return `${this.status_line()} | ${this.message.summary()}`;
	}
	public report(): void {
		console.log(`${this.summary()} | reportable=${this.reportable()}`);
	}
}
import type { MessageContract } from "src/protocols"; // <- error
// File: cli.ts
import { Message } from "src/message";
import { MessageStatus } from "src/message_status";
(function () {
	const message = new Message("ready");
	const status = new MessageStatus(message);
	status.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface MessageContract {
	normalized_text(): string;
	word_count(): number;
	character_count(): number;
	summary(): string;
}
// File: src/message.ts
import type { MessageContract } from "src/protocols";
export class Message implements MessageContract {
	private readonly _text: string;
	public constructor(text: string) {
		this._text = text;
	}
	public normalized_text(): string {
		return this._text.trim().toUpperCase();
	}
	public word_count(): number {
		return this.normalized_text().split(/\s+/u).filter((word) => word.length > 0).length;
	}
	public character_count(): number {
		return this.normalized_text().replace(/\s/gu, "").length;
	}
	public summary(): string {
		const text = this.normalized_text();
		const separator = text.indexOf(" ");
		let first_word = text;
		if (separator >= 0) { first_word = text.slice(0, separator); }
		return `${first_word} | ${this.word_count()} words, ${this.character_count()} characters`;
	}
}
// File: src/message_status.ts
import type { MessageContract } from "src/protocols";
export class MessageStatus {
	private readonly _message: MessageContract;
	private status_line(): string {
		const text = this._message.normalized_text();
		if (text.length === 0) { return "UNAVAILABLE"; }
		return `Status: ${text}`;
	}
	public constructor(message: MessageContract) {
		this._message = message;
	}
	public reportable(): boolean {
		return this._message.word_count() > 0;
	}
	public summary(): string {
		return `${this.status_line()} | ${this._message.summary()}`;
	}
	public report(): void {
		console.log(`${this.summary()} | reportable=${this.reportable()}`);
	}
}
// File: cli.ts
import { Message } from "src/message";
import { MessageStatus } from "src/message_status";
(function () {
	const message = new Message("ready");
	const status = new MessageStatus(message);
	status.report();
})();
```
