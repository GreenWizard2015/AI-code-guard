# pointless-boolean-operation

Description: Reports a boolean identity comparison whose only body action is returning.
The syntax differs by language, but the hack is the same: a direct boolean
value is hidden behind a branch that adds no behavior.

## Bad


```ts
// File: src/readiness.ts
export class Readiness {
	private readonly value: boolean;
	private readonly component: string;
	public constructor(value: boolean, component: string) {
		this.value = value;
		this.component = component;
	}
	public ready(): boolean {
		const ready_value = this.value;
		if (ready_value === true) { return true; }
		return false;
	}
	public label(): string {
		if (this.ready()) { return "ready"; }
		return "blocked";
	}
	public description(): string {
		const state_label = this.label();
		return `${this.component}: ${state_label}`;
	}
	public report(): void { console.log(this.description()); }
}
// File: cli.ts
import { Readiness } from "src/readiness";
(function () {
	const readiness = new Readiness(true, "worker");
	readiness.report();
})();
```

## Good


```ts
// File: src/readiness.ts
export class Readiness {
	private readonly _blocking_components: string[];
	private readonly _component: string;
	public constructor(value: boolean, component: string) {
		this._component = component;
		if (value) {
			this._blocking_components = [];
		} else {
			this._blocking_components = [component];
		}
	}
	public resolve_component(component: string): void {
		const blocking_index = this._blocking_components.indexOf(component);
		if (blocking_index >= 0) {
			this._blocking_components.splice(blocking_index, 1);
		}
	}
	public ready(): boolean {
		return this._blocking_components.length === 0;
	}
	public label(): string {
		if (this.ready()) { return "ready"; }
		return "blocked";
	}
	public description(): string {
		const state_label = this.label();
		return `${this._component}: ${state_label}`;
	}
	public report(): void { console.log(this.description()); }
}
// File: cli.ts
import { Readiness } from "src/readiness";
(function () {
	const readiness = new Readiness(false, "worker");
	readiness.resolve_component("worker");
	readiness.report();
})();
```
