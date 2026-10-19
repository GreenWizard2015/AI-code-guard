# module-types-separation

Description: Keep a module-level type declaration in the exact sibling `types.ts` or `types.py`, separate from implementation.

## Bad

```ts
// File: src/queue/message-queue.ts
type MessageQueueOptions = { capacity: number };
export class MessageQueue {
	private readonly capacity_value: number;
	public constructor(options: MessageQueueOptions) { this.capacity_value = options.capacity; }
	public capacity(): number { return this.capacity_value; }
}
```


## Good

```ts
// File: src/queue/types.ts
export type MessageQueueCapacity = number;
// File: src/queue/protocols.ts
import { MessageQueueCapacity } from "src/queue/types";
export interface MessageQueueContract {
	capacity(): MessageQueueCapacity;
	accepts_size(size: number): boolean;
}
```

