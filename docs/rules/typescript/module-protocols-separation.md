# module-protocols-separation

Description: Keep a module-level protocol in the sibling `protocols.ts` or `protocols.py` file.

## Bad

```ts
// File: src/message_queue.ts
interface MessageQueueContract {
	enqueue(message: string): void;
	count(): number;
}
/** Responsibilities: _queue state and operations_. **/
export class MessageQueue implements MessageQueueContract { // <- error
	private readonly messages: string[];
	/** Responsibilities: _queue initialization_. **/
	public constructor() {
		this.messages = [];
	}
	/** Responsibilities: _message storage_. **/
	public enqueue(message: string): void {
		const normalized_message = message.trim();
		if (normalized_message.length > 0) { this.messages.push(normalized_message); }
	}
	/** Responsibilities: _queue size_. **/
	public count(): number {
		return this.messages.length;
	}
	/** Responsibilities: _queue status output_. **/
	public report(): void {
		console.log(`Queued ${this.count()} messages`);
	}
}
// File: cli.ts
import { MessageQueue } from "src/message_queue";

(() => {
	const queue = new MessageQueue();
	queue.enqueue("message");
	queue.report();
})();
```


## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _queue operation contract_. **/
export interface MessageQueueContract {
	enqueue(message: string): void;
	count(): number;
}
export interface QueueStatusContract { empty(): boolean; }
// File: src/message_queue.ts
import type { MessageQueueContract, QueueStatusContract } from "src/protocols";
/** Responsibilities: _queue state_, _message operations_. **/
export class MessageQueue implements MessageQueueContract, QueueStatusContract {
	private readonly _messages: string[];
	/** Responsibilities: _queue initialization_. **/
	public constructor() {
		this._messages = [];
	}
	/** Responsibilities: _message storage_. **/
	public enqueue(message: string): void {
		const normalized = message.trim();
		if (normalized.length > 0) { this._messages.push(normalized); }
	}
	/** Responsibilities: _queue size_. **/
	public count(): number {
		let count = 0;
		for (const message of this._messages) { if (message.length > 0) { count += 1; } }
		return count;
	}
	/** Responsibilities: _empty queue classification_. **/
	public empty(): boolean {
		for (const message of this._messages) { if (message.length > 0) { return false; } }
		return true;
	}
	/** Responsibilities: _queue status output_. **/
	public report(): void {
		console.log(`Queued ${this.count()} messages; empty=${this.empty()}`);
	}
}
// File: cli.ts
import { MessageQueue } from "src/message_queue";

(() => {
	const queue = new MessageQueue();
	queue.enqueue("message");
	queue.report();
})();
```

