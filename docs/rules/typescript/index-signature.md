# `index-signature`

Description: Do not use open-ended TypeScript index signatures in interfaces or object types.

## Bad

```ts
// File: src/protocols.ts
export interface RuntimeRecordContract {
	[key: string]: string; // <- error
}
// File: src/runtime_record.ts
import type { RuntimeRecordContract } from "src/protocols";
/** Responsibilities: _open-ended record access_, _record reporting_. **/
export class RuntimeRecord {
	private readonly values: RuntimeRecordContract;
	/** Responsibilities: _record initialization_. **/
	public constructor(values: RuntimeRecordContract) {
		this.values = values;
	}
	/** Responsibilities: _record key count_. **/
	public key_count(): number {
		return Object.keys(this.values).length;
	}
	/** Responsibilities: _record key collection_. **/
	public keys(): string[] {
		return Object.keys(this.values);
	}
	/** Responsibilities: _record summary composition_. **/
	public summary(): string {
		return `${this.key_count()} values: ${this.keys().join(", ")}`;
	}
	/** Responsibilities: _record summary output_. **/
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { RuntimeRecord } from "src/runtime_record";
(function () {
	const record = new RuntimeRecord({ ready: "yes", state: "active" });
	record.report();
})();
```

**Fix:** Replace the unbounded key space with a named contract and explicit behavior, or define
the permitted keys explicitly.

## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _named record contract_. **/
export interface RuntimeRecordContract {
	value(name: string): string;
	key_count(): number;
}
// File: src/runtime_record.ts
import type { RuntimeRecordContract } from "src/protocols";
/** Responsibilities: _named values_, _record summary reporting_. **/
export class RuntimeRecord implements RuntimeRecordContract {
	private readonly _first_value: string;
	private readonly _second_value: string;
	/** Responsibilities: _record initialization_. **/
	public constructor(first_value: string, second_value: string) {
		this._first_value = first_value;
		this._second_value = second_value;
	}
	/** Responsibilities: _named value access_. **/
	public value(name: string): string {
		if (name === "first") {
			return this._first_value;
		}
		return this._second_value;
	}
	/** Responsibilities: _named value count_. **/
	public key_count(): number {
		return 2;
	}
	/** Responsibilities: _record summary composition_. **/
	public summary(): string {
		return `${this.value("first")}, ${this.value("second")}`;
	}
	/** Responsibilities: _record summary output_. **/
	public report(): void {
		console.log(`${this.summary()} (${this.key_count()})`);
	}
}
// File: cli.ts
import { RuntimeRecord } from "src/runtime_record";
(function () {
	const record = new RuntimeRecord("ready", "active");
	record.report();
})();
```
