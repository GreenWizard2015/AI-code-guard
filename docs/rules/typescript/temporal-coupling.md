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
class Session {
	private socket: WebSocket;
	public connect(): void { this.socket = new WebSocket("ws://localhost"); }
	public send(message: string): void { this.socket.send(message); }
}
```


## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
