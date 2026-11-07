# `explicit-visibility`

Description: Implicit visibility on class fields and methods hides the public API. Properties in interfaces and object type aliases are public by definition; TypeScript does not allow visibility modifiers on them.

Fix: Declare `public`, `protected`, or `private` on every class field and method.

## Bad

```ts
// File: src/message_queue.ts
export class MessageQueue { // <- error
	items: string[] = [];
	append(item: string): void {
		const normalized_item = item.trim();
		this.items.push(normalized_item);
	}
	item_count(): number {
		return this.items.length;
	}
	summary(): string {
		return `Queued ${this.item_count()} messages`;
	}
	report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { MessageQueue } from "src/message_queue";

(() => {
	const queue = new MessageQueue();
	queue.append(" ready ");
	queue.report();
})();
```

## Good

```ts
// File: src/message_queue.ts
/** Responsibilities: _message queue_. **/
export class MessageQueue {
	private readonly _messages: string[];
	/** Responsibilities: _queue initialization_. **/
	public constructor() {
		this._messages = [];
	}
	/** Responsibilities: _message enqueueing_. **/
	public append(item: string): void {
		const normalized_item = item.trim();
		this._messages.push(normalized_item);
	}
	/** Responsibilities: _batch message enqueueing_. **/
	public append_all(items: readonly string[]): void {
		for (const item of items) {
			this.append(item);
		}
	}
	/** Responsibilities: _queue size reporting_. **/
	public item_count(): number {
		return this._messages.length;
	}
	/** Responsibilities: _queued message formatting_. **/
	public contents(): string {
		return this._messages.join(", ");
	}
	/** Responsibilities: _queue summary formatting_. **/
	public summary(): string {
		return `Queued ${this.item_count()} messages: ${this.contents()}`;
	}
	/** Responsibilities: _queue report output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { MessageQueue } from "src/message_queue";

(() => {
	const queue = new MessageQueue();
	queue.append_all([" ready "]);
	queue.report();
})();
```
