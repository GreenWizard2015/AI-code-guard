# temporal-coupling

Description: The rule reports a field that is written by one non-constructor method and read
by another method without initialization in the constructor or field
declaration. This is a structural signal that callers must discover a hidden
method order; constructor-initialized fields and explicit state objects are
allowed.

```ts
class Session {
	connect(): void {
		this.socket = open_socket();
	}

	send(message: string): void {
		this.socket.send(message);
	}
}
```

Initialize the dependency in the constructor, or represent disconnected and
connected states as explicit objects. A deliberately lazy field should expose
its readiness transition instead of relying on an undocumented call order.

## Bad

```ts
// File: src/session.ts
export class Session {
	private socket: string;
	public connect(): void {
		this.socket = "connected";
	}
	public send(message: string): string {
		return `${this.socket}: ${message}`;
	}
	public report(): void {
		this.connect();
		console.log(this.send("ping"));
	}
}
// File: cli.ts
import { Session } from "src/session";
(function () {
	const session = new Session();
	session.report();
})();
```


## Good

```ts
// File: src/session.ts
export class Session {
	private readonly _sent_messages: string[];
	private readonly _socket: string;
	private readonly _session_id: string;
	public constructor(session_id: string, socket: string) {
		this._session_id = session_id;
		this._socket = socket;
		this._sent_messages = [];
	}
	public send(message: string): string {
		const normalized_message = message.trim();
		this._sent_messages.push(normalized_message);
		return `${this._session_id} via ${this._socket}: ${normalized_message}`;
	}
	public state_label(): string {
		return `Session ${this._session_id} on ${this._socket}`;
	}
	public socket_summary(): string {
		const socket_name = this._socket.trim().toUpperCase();
		const socket_length = this._socket.length;
		return `${socket_name} (${socket_length} characters)`;
	}
	public session_summary(): string {
		const state = this.state_label();
		const socket = this.socket_summary();
		const response = this.send("ping");
		const sent_history = this._sent_messages.splice(0, this._sent_messages.length);
		return `${state} | ${socket} | ${response} | sent=${sent_history.join(", ")}`;
	}
	public report(): void {
		console.log(this.session_summary());
	}
}
// File: cli.ts
import { Session } from "src/session";
(function () {
	const session = new Session("session-1", "connected");
	session.report();
})();
```
