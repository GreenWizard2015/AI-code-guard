# `conditional-block`

Description: Unbraced branches are easy to extend incorrectly.

```ts
// File: src/connection_status.ts
export class ConnectionStatus {
	private readonly channel: string;
	public constructor(channel: string) {
		this.channel = channel;
	}
	private format_status(is_ready: boolean): string {
		let status = "waiting";
		if (is_ready) status = "ready";
		return status;
	}
	public status_line(): string {
		return `${this.channel}: ${this.format_status(true)}`;
	}
	public report(): void {
		console.log(this.status_line());
	}
}
// File: cli.ts
import { ConnectionStatus } from "src/connection_status";
(function () {
	const status = new ConnectionStatus("primary");
	status.report();
})();
```


Fix: Always use braces: `if (ready) { send(); }`.

## Bad

```ts
// File: src/connection_status.ts
export class ConnectionStatus {
	private readonly channel: string;
	private readonly ready: boolean;
	public constructor(channel: string, ready: boolean) {
		this.channel = channel;
		this.ready = ready;
	}
	private format_status(): string {
		let status = "waiting";
		if (this.ready) status = "ready"; // <- error
		return status;
	}
	public status_line(): string {
		return `${this.channel}: ${this.format_status()}`;
	}
	public report(): void {
		console.log(this.status_line());
	}
}
// File: cli.ts
import { ConnectionStatus } from "src/connection_status";
(function () {
	const status = new ConnectionStatus("primary", true);
	status.report();
})();
```

## Good

```ts
// File: src/connection_status.ts
export class ConnectionStatus {
	private readonly _channel: string;
	private readonly _ready: boolean;
	private format_status(): string {
		let status = "waiting";
		if (this._ready) {
			status = "ready";
		}
		return status;
	}
	public constructor(channel: string, ready: boolean) {
		this._channel = channel;
		this._ready = ready;
	}
	public status_line(): string {
		return `${this._channel}: ${this.format_status()}`;
	}
	public report(): void {
		console.log(this.status_line());
	}
}
// File: cli.ts
import { ConnectionStatus } from "src/connection_status";
(function () {
	const status = new ConnectionStatus("primary", true);
	status.report();
})();
```
