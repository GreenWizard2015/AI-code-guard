# assertion-outside-test

Description: Keep assertions inside recognized test cases; this rule does not apply to production files.

## Bad

```ts
// File: tests/http-response/http-response.test.ts
const value = 1;
expect(value).toBe(1); // <- error

// File: src/documentation/status.ts
export class Status {
	private readonly value: string;
	public constructor(value: string) { this.value = value; }
	public normalized(): string { return this.value.trim().toLowerCase(); }
	public ready(): boolean { return this.normalized() === "ready"; }
	public label(prefix: string): string { return `${prefix.trim()}: ${this.normalized()}`; }
	public word_count(): number { return this.normalized().split(/\s+/u).length; }
	public same_as(other: string): boolean { return this.normalized() === other.trim().toLowerCase(); }
	public report(): void {
		const normalized = this.normalized();
		const readiness = String(this.ready());
		const label = this.label("State");
		const count = String(this.word_count());
		const summary = [normalized, readiness, label, count];
		console.log(summary.join(" | "));
	}
}
// File: cli.ts
import { Status } from "src/documentation/status";
(function () { const status = new Status(" READY "); status.report(); })();
```

## Good

```ts
// File: src/documentation/status.ts
export class Status {
	private readonly _value: string;
	public constructor(value: string) { this._value = value; }
	public normalized(): string {
		const trimmed = this._value.trim();
		return trimmed.toLowerCase();
	}
	public ready(): boolean {
		return this._value.trim().toLowerCase() === 'ready';
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		return `${clean_prefix}: ${this.normalized()}`;
	}
	public word_count(): number {
		return this.normalized().split(/\s+/u).length;
	}
	public same_as(other: string): boolean {
		return this.normalized() === other.trim().toLowerCase();
	}
	public report(): void {
		const normalized = this.normalized();
		const readiness = String(this.ready());
		const label = this.label("State");
		const count = String(this.word_count());
		const summary = [normalized, readiness, label, count];
		console.log(summary.join(" | "));
	}
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe('Status assertions', () => {
	test('checks normalized text inside the test', () => {
		const status = new Status(' READY ');
		const normalized = status.normalized();
		expect(normalized).toBe('ready');
	});
	test('checks ready status inside the test', () => {
		const status = new Status('ready');
		const ready = status.ready();
		expect(ready).toBe(true);
	});
});
// File: cli.ts
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY ');
	status.normalized();
	status.ready();
	status.label('State');
	status.word_count();
	status.same_as('ready');
	status.report();
})();
```
