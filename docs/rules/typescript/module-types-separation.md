# module-types-separation

Description: Keep a module-level type declaration in the exact sibling `types.ts` or `types.py`, separate from implementation.

## Bad

```ts
// File: src/queue/message-queue.ts
type MessageQueueOptions = { capacity: number };
export class MessageQueue {
	private readonly capacity_value: number;
	public constructor(capacity: number) { this.capacity_value = capacity; }
	public available_capacity(reserved: number): number {
		const options: MessageQueueOptions = { capacity: this.capacity_value };
		const available = options.capacity - reserved;
		return Math.max(0, available);
	}
	public capacity_label(): string {
		const options: MessageQueueOptions = { capacity: this.capacity_value };
		if (options.capacity < 10) { return "compact"; }
		if (options.capacity < 100) { return "standard"; }
		return "large";
	}
	public summary(): string {
		const label = this.capacity_label();
		const available = this.available_capacity(0);
		return `${label} queue with ${available} slots`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { MessageQueue } from "src/queue/message-queue";

(function run(): void {
	const queue = new MessageQueue(8);
	queue.report();
})();
```


## Good

```ts
// File: src/queue/types.ts
export type MessageQueueOptions = {
	capacity: number;
};
// File: src/queue/message_queue.ts
import type { MessageQueueOptions } from "src/queue/types";

export class MessageQueue {
	private readonly _capacity_value: number;

	public constructor(capacity: number) {
		this._capacity_value = capacity;
	}

	public available_capacity(reserved: number): number {
		const options: MessageQueueOptions = { capacity: this._capacity_value };
		const available = options.capacity - reserved;
		return Math.max(0, available);
	}

	public capacity_label(): string {
		const options: MessageQueueOptions = { capacity: this._capacity_value };
		if (this._capacity_value < 10) {
			return "compact";
		}
		if (this._capacity_value < 100) {
			return "standard";
		}
		return "large";
	}

	public summary(): string {
		const label = this.capacity_label();
		const available = this.available_capacity(0);
		return `${label} queue with ${available} slots`;
	}

	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { MessageQueue } from "src/queue/message_queue";

(function run(): void {
	const queue = new MessageQueue(8);
	queue.report();
})();
```

