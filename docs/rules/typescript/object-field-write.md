# `object-field-write`

Description: Assign only to `this._field` and its nested named fields.

## Bad

```ts
// File: src/types.ts
export type StoreState = { value: string };
// File: src/store.ts
import type { StoreState } from "src/types";
export class Store {
	private readonly _state: StoreState;
	public constructor() { this._state = { value: "ready" }; }
	public update(other: Store): void {
		this.state = "public"; // <- error
		other._state.value = "foreign"; // <- error
		createStore().state = "temporary"; // <- error
	}
	public ready(): boolean { return this._state.value.length > 0; }
	public state_label(): string {
		const value = this._state.value;
		return value.trim();
	}
	public value_length(): number {
		let length = 0;
		for (const character of this._state.value) {
			if (character.trim().length > 0) { length += 1; }
		}
		return length;
	}
	public summary(): string {
		const state = this.ready() ? "ready" : "empty";
		return `${this.state_label()}: ${state} (${this.value_length()})`;
	}
	public report(): void { console.log(`Store: ${this.summary()}`); }
}
function createStore(): Store { return new Store(); }
// File: cli.ts
import { Store } from "src/store";
(function () {
	const store = new Store();
	store.update(new Store());
	store.report();
})();
```

## Good

```ts
// File: src/types.ts
export type StoreState = { value: string };
// File: src/store.ts
import type { StoreState } from "src/types";
export class Store {
	private readonly _state: StoreState;
	public constructor() { this._state = { value: "ready" }; }
	public update(): void {
		this._state.value = "updated";
	}
	public ready(): boolean { return this._state.value.length > 0; }
	public state_label(): string {
		const value = this._state.value;
		return value.trim();
	}
	public value_length(): number {
		let length = 0;
		for (const character of this._state.value) {
			if (character.trim().length > 0) { length += 1; }
		}
		return length;
	}
	public summary(): string {
		const state = this.ready() ? "ready" : "empty";
		return `${this.state_label()}: ${state} (${this.value_length()})`;
	}
	public report(): void { console.log(`Store: ${this.summary()}`); }
}
// File: cli.ts
import { Store } from "src/store";
(function () {
	const store = new Store();
	store.update();
	store.report();
})();
```
