# `mutable-field`

Description: Unnecessary TypeScript field mutation increases lifecycle coupling.

```ts
class Cache { public value: Result | null = null; }
```


Fix: Prefer `readonly` and return updated state; keep mutation only when it is intentional.

## Bad

```ts
// File: src/retry_counter.ts
export class RetryCounter {
	public attempts: number = 0;
	private readonly increment: number;
	public constructor(increment: number) {
		this.increment = increment;
	}
	public record_attempt(): void {
		this.attempts += this.increment;
	}
	public remaining(limit: number): number {
		const outstanding = limit - this.attempts;
		if (outstanding < 0) {
			return 0;
		}
		return outstanding;
	}
	public report(): void {
		console.log(`attempts=${this.attempts} | remaining=${this.remaining(5)}`);
	}
}
// File: cli.ts
import { RetryCounter } from "src/retry_counter";
(function () {
	const counter = new RetryCounter(1);
	counter.record_attempt();
	counter.report();
})();
```

## Good

```ts
// File: src/retry_counter.ts
export class RetryCounter {
	private readonly _attempts: number;
	private readonly _increment: number;
	public constructor(attempts: number, increment: number) {
		this._attempts = attempts;
		this._increment = increment;
	}
	public attempts_after_recording(): number {
		return this._attempts + this._increment;
	}
	public remaining(limit: number): number {
		if (this._attempts >= limit) {
			return 0;
		}
		const outstanding = limit - this.attempts_after_recording();
		if (outstanding < 0) {
			return 0;
		}
		return outstanding;
	}
	public report(): void {
		console.log(`attempts=${this.attempts_after_recording()} | remaining=${this.remaining(5)}`);
	}
}
// File: cli.ts
import { RetryCounter } from "src/retry_counter";
(function () {
	const counter = new RetryCounter(0, 1);
	counter.report();
})();
```
