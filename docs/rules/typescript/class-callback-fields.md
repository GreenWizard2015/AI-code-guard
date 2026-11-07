# `class-callback-fields`

Description: Do not store callback behavior as an inline function default on an implementation
class. Declare a method or delegate to a focused collaborator that owns the
behavior.

## Bad

```ts
// File: src/message_delivery.ts
export class MessageDelivery {
	public on_delivered = (message: string): string => message.trim().toUpperCase();
	public report(): void {
		const delivered_message = this.on_delivered("ready");
		console.log(delivered_message);
	}
}
// File: cli.ts
import { MessageDelivery } from "src/message_delivery";
(function () {
	const delivery = new MessageDelivery();
	delivery.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface MessageDeliveryContract {
	on_delivered(message: string): string;
}
// File: src/message_delivery.ts
import type { MessageDeliveryContract } from "src/protocols";

/** Responsibilities: _message delivery behavior_. **/
export class MessageDelivery implements MessageDeliveryContract {
	private readonly _channel: string;
	private readonly _maximum_length: number;
	public constructor(channel: string, maximum_length: number) {
		this._channel = channel;
		this._maximum_length = maximum_length;
	}
	public on_delivered(message: string): string {
		return `${this._channel}: ${this.delivery_status(message)}`;
	}
	public delivery_status(input_text: string): string {
		const normalized_message = input_text.trim().toUpperCase();
		if (normalized_message.length > this._maximum_length) { return "rejected"; }
		return `accepted ${normalized_message}`;
	}
	public delivery_label(delivery_text: string): string {
		return `${this._channel} ${this.delivery_status(delivery_text)}`;
	}
	public report(): void {
		console.log(this.delivery_label("ready"));
	}
}
// File: cli.ts
import { MessageDelivery } from "src/message_delivery";
(function () {
	const delivery = new MessageDelivery("email", 20);
	delivery.report();
})();
```
