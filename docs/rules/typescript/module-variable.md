# `module-variable`

Description: Keep mutable module state inside an owning object.

## Bad

```ts
// File: src/request_counter.ts
let request_count = 0;
export class RequestCounter {
	private readonly maximum_count: number;
	public constructor(maximum_count: number) {
		this.maximum_count = maximum_count;
	}
	public capacity_available(): boolean {
		return request_count < this.maximum_count;
	}
	public record_request(): void {
		if (this.capacity_available()) {
			request_count += 1;
		}
	}
	public report(): void {
		console.log(`requests=${request_count} | capacity=${this.capacity_available()}`);
	}
}
// File: cli.ts
import { RequestCounter } from "src/request_counter";
(function () {
	const counter = new RequestCounter(3);
	counter.record_request();
	counter.report();
})();
```

## Good

```ts
// File: src/protocols.ts
export interface RequestCounterContract {
	capacity_available(): boolean;
	record_request(): RequestCounterContract;
	report_count(): number;
}
// File: src/request_counter.ts
import type { RequestCounterContract } from "src/protocols";

/** Responsibilities: _request count state_. **/
export class RequestCounter implements RequestCounterContract {
	private readonly _count: number;
	private readonly _maximum_count: number;

	/** Responsibilities: _counter initialization_. **/
	public constructor(count: number, maximum_count: number) {
		this._count = count;
		this._maximum_count = maximum_count;
	}

	/** Responsibilities: _request capacity check_. **/
	public capacity_available(): boolean {
		const current_count = Math.max(0, this._count);
		const maximum_count = Math.max(0, this._maximum_count);
		return current_count < maximum_count;
	}

	/** Responsibilities: _request count transition_. **/
	public record_request(): RequestCounterContract {
		if (!this.capacity_available()) {
			return this;
		}
		return new RequestCounter(Math.max(0, this._count + 1), this._maximum_count);
	}

	/** Responsibilities: _request count reporting_. **/
	public report_count(): number {
		const normalized_count = Math.max(0, this._count);
		const output = String(normalized_count);
		console.log(output);
		return normalized_count;
	}
}
// File: cli.ts
import { RequestCounter } from "src/request_counter";
import type { RequestCounterContract } from "src/protocols";

(function () {
	let counter: RequestCounterContract = new RequestCounter(0, 2);
	counter = counter.record_request();
	counter.report_count();
})();
```
