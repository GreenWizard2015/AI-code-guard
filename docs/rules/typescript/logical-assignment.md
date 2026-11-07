# `logical-assignment`

Description: Logical assignment hides a conditional state transition in TypeScript.

```ts
value ??= create_value();
cache ||= load_cache();
```


Fix: Use an explicit condition followed by an assignment. Keep the state transition visible.

## Bad

```ts
// File: src/connection_state.ts
export class ConnectionState {
	private readonly fallback: string;
	public constructor(fallback: string) {
		this.fallback = fallback;
	}
	public resolve_state(current_state: string): string {
		let resolved_state = current_state;
		resolved_state ||= this.fallback;
		return resolved_state;
	}
	public status_label(current_state: string): string {
		const resolved_state = this.resolve_state(current_state);
		return `Connection status: ${resolved_state}`;
	}
	public report(): void {
		console.log(this.status_label(""));
	}
}
// File: cli.ts
import { ConnectionState } from "src/connection_state";
(function () {
	const state = new ConnectionState("waiting");
	state.report();
})();
```

## Good

```ts
// File: src/connection_state.ts
export class ConnectionState {
	private readonly _fallback: string;
	public constructor(fallback: string) {
		this._fallback = fallback;
	}
	public resolve_state(current_state: string): string {
		let resolved_state = current_state;
		if (resolved_state.length === 0 && this._fallback.length > 0) {
			resolved_state = this._fallback;
		}
		return resolved_state;
	}
	public status_label(current_state: string): string {
		const resolved_state = this.resolve_state(current_state);
		return `Connection status: ${resolved_state}`;
	}
	public report(): void {
		console.log(this.status_label(""));
	}
}
// File: cli.ts
import { ConnectionState } from "src/connection_state";
(function () {
	const state = new ConnectionState("waiting");
	state.report();
})();
```
