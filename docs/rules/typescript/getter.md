# `getter`

Description: Keep reads explicit. A TypeScript `get` accessor hides a method call behind property access.

## Bad

```ts
// File: src/status.ts
/** Responsibilities: _status reporting_. **/
export class Status {
	/** Responsibilities: _status value access_. **/
	public get value(): string { return "ready"; } // <- error
	/** Responsibilities: _status output_. **/
	public report(): void { console.log(this.value); }
}
// File: cli.ts
import { Status } from "src/status";
(function () {
	const status = new Status();
	status.report();
})();
```

## Good

```ts
// File: src/status.ts
/** Responsibilities: _status reporting_. **/
export class Status {
	private readonly _status_history: string[];
	public constructor(value: string) {
		this._status_history = [value];
	}

	public change_value(value: string): void {
		this._status_history.push(value);
	}

	/** Responsibilities: _status value access_. **/
	public value(): string {
		return this._status_history.at(-1) ?? "unknown";
	}
	public ready(): boolean { return this.value() === "ready"; }
	public label(): string { return `Status: ${this.value()}`; }
	public word_count(): number {
		const text = this.value().trim();
		if (text.length === 0) { return 0; }
		return text.split(/\s+/u).length;
	}
	/** Responsibilities: _status output_. **/
	public report(): void {
		console.log(`${this.label()} ${this.ready()} ${this.word_count()}`);
	}
}
// File: cli.ts
import { Status } from "src/status";
(function () {
	const status = new Status("queued");
	status.change_value("ready");
	status.report();
})();
```
