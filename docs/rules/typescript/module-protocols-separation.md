# module-protocols-separation

Description: Keep a module-level protocol in the sibling `protocols.ts` or `protocols.py` file.

## Bad

```ts
// File: src/queue.ts
interface MessageQueueContract { enqueue(message: string): void; }
export class MessageQueue implements MessageQueueContract {
	public enqueue(message: string): void {}
}
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
import type { MessageQueueContract } from "src/protocols";
import type { QueueStatusContract } from "src/protocols";
/** Responsibilities: _queue state_, _message operations_. **/
export class MessageQueue implements MessageQueueContract, QueueStatusContract {
	private readonly messages: string[] = [];
	/** Responsibilities: _message storage_. **/
	public enqueue(message: string): void {
		const normalized = message.trim();
		if (normalized.length > 0) { this.messages.push(normalized); }
	}
	/** Responsibilities: _queue size_. **/
	public count(): number {
		let count = 0;
		for (const message of this.messages) { if (message.length > 0) { count += 1; } }
		return count;
	}
	/** Responsibilities: _empty queue classification_. **/
	public empty(): boolean {
		for (const message of this.messages) { if (message.length > 0) { return false; } }
		return true;
	}
}
// File: cli.ts
import { MessageQueue } from "src/message_queue";
(function (): void {
	const queue = new MessageQueue();
	queue.enqueue("message");
	console.log(queue.count(), queue.empty());
})();
```

