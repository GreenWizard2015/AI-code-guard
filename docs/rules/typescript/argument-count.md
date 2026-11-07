# argument-count

Description: Replace a long positional call contract with a named request object that keeps the same operation and result.

## Bad

```ts
// File: src/message-sender.ts
export class MessageSender {
	public send(recipient: string, subject: string, body: string, content_type: string, priority: number, retry_limit: number): string { return `${recipient}:${subject}:${body}:${content_type}:${priority}:${retry_limit}`; }
	public report(): void {
		const output = this.send("reader", "status", "ready", "text/plain", 2, 3);
		console.log(output);
	}
}
// File: cli.ts
import { MessageSender } from "src/message-sender";

(function run(): void {
	const sender = new MessageSender();
	sender.report();
})();
```


## Good

```ts
// File: src/protocols.ts
export type MessageRequest = {
	readonly recipient: string;
	readonly subject: string;
	readonly body: string;
	readonly content_type: string;
	readonly priority: number;
	readonly retry_limit: number;
};
export interface MessageSenderContract {
	send(request: MessageRequest): string;
}
// File: src/message_sender.ts
import type { MessageRequest, MessageSenderContract } from "src/protocols";

export class MessageSender implements MessageSenderContract {
	private readonly _sender_name: string;

	public constructor(sender_name: string) {
		this._sender_name = sender_name;
	}

	public send(request: MessageRequest): string {
		const recipient = request.recipient.trim();
		const subject = request.subject.trim();
		const body = request.body.trim();
		const content_type = request.content_type.trim();
		const priority = request.priority;
		const retry_limit = request.retry_limit;
		return `${this._sender_name}: ${recipient}:${subject}:${body}:${content_type}:${priority}:${retry_limit}`;
	}

	public report(): void {
		const request: MessageRequest = {
			recipient: "reader", subject: "status", body: "ready",
			content_type: "text/plain", priority: 2, retry_limit: 3,
		};
		const output = this.send(request);
		console.log(output);
	}
}
// File: cli.ts
import { MessageSender } from "src/message_sender";

(function run(): void {
	const sender = new MessageSender("queue");
	sender.report();
})();
```

