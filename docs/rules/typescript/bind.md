# `bind`

Description: Avoid `.bind(...)` callback construction.

```ts
const callback = service.run.bind(service);
```

### Alternative

Use an explicit lambda so the receiver and arguments remain visible:

```ts
// File: cli.ts
(function () {
	const callback = (...args: string[]) => service.run(...args);
})();
```

## Bad

```ts
// File: src/message_sender.ts
export class MessageSender {
	private readonly channel: string;
	public constructor(channel: string) {
		this.channel = channel;
	}
	public send(message: string): string {
		const normalized_message = message.trim();
		return `${this.channel}: ${normalized_message}`;
	}
	public callback(): (message: string) => string {
		return this.send.bind(this);
	}
	public report(): void {
		const sender = this.callback();
		const result = sender("ready");
		console.log(result);
	}
}
// File: cli.ts
import { MessageSender } from "src/message_sender";
(function () {
	const sender = new MessageSender("email");
	sender.report();
})();
```

## Good

```ts
// File: src/message_sender.ts
/** Responsibilities: _message dispatch policy_. **/
export class MessageSender {
	private readonly _channel: string;
	private readonly _maximum_length: number;
	private readonly _delivery_history: string[];
	public constructor(channel: string, maximum_length: number) {
		this._channel = channel;
		this._maximum_length = maximum_length;
		this._delivery_history = [];
	}
	public send(payload: string): string {
		const normalized_payload = payload.trim().replace(/\s+/gu, " ");
		const channel_label = this._channel.trim().toLowerCase();
		const bounded_payload = normalized_payload.slice(0, this._maximum_length);
		const delivery = `${channel_label}: ${bounded_payload}`;
		this._delivery_history.push(delivery);
		return delivery;
	}
	public send_priority(priority_text: string): string {
		const normalized_text = priority_text.trim().replace(/\s+/gu, " ");
		const bounded_text = normalized_text.slice(0, this._maximum_length);
		const channel_label = this._channel.trim().toUpperCase();
		const delivery = `${channel_label} [priority]: ${bounded_text}`;
		this._delivery_history.push(delivery);
		return delivery;
	}
	public send_batch(entries: string[]): string {
		const sent_entries: string[] = [];
		for (const entry of entries) {
			sent_entries.push(this.send(entry));
		}
		return `${sent_entries.length} sent: ${sent_entries.join(", ")}`;
	}
	public delivery_summary(batch_values: string[]): string {
		const batch_summary = this.send_batch(batch_values);
		const channel_label = this._channel.trim().toLowerCase();
		return `${channel_label} delivery (${this._delivery_history.length} total): ${batch_summary}`;
	}
	public report(): void {
		const callback = (message_text: string): string => {
			const normalized_text = message_text.trim().replace(/\s+/gu, " ");
			const bounded_text = normalized_text.slice(0, this._maximum_length);
			const channel_label = this._channel.trim().toLowerCase();
			return `${channel_label} callback: ${bounded_text}`;
		};
		console.log(callback("ready"), callback("queued"), this.send_priority("urgent"));
		console.log(this.delivery_summary(["stored", "delivered"]));
	}
}
// File: cli.ts
import { MessageSender } from "src/message_sender";
(function () {
	const sender = new MessageSender("email", 32);
	sender.report();
})();
```
