# `jest-type-only-test`

Description: Every Jest test must verify an actual result or observable behavior. A test that
only checks types, fields, methods, or object shape is not a behavior test.

## Bad

```ts
// File: src/documentation/status.ts
export class Status {
	private readonly value: string;
	public constructor(value: string) {
		this.value = value;
	}
	public normalized(): string {
		return this.value.trim().toLowerCase();
	}
	public ready(): boolean { return this.normalized() === 'ready'; }
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		return `${clean_prefix}: ${this.normalized()}`;
	}
	public contains_word(word: string): boolean {
		const normalized_word = word.trim().toLowerCase();
		const words = this.normalized().split(/\s+/u);
		return words.includes(normalized_word);
	}
	public report(): void {
		const fields = [
			this.normalized(),
			String(this.ready()),
			this.label("Current"),
			String(this.contains_word("ready")),
		];
		console.log(fields.join(" | "));
	}
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe("Status", () => {
	test("checks the instance type and core member shape", () => {
		const status: Status = new Status("ready");
		expect(status.normalized).toBeDefined();
	});
	test("checks the remaining member shape", () => {
		const status: Status = new Status("ready");
		expect(status.ready).toBeDefined();
	});
});
// File: cli.ts
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY value ');
	status.report();
})();
```

## Good

```ts
// File: src/documentation/status.ts
export class Status {
	private readonly _value: string;
	public constructor(value: string) {
		this._value = value;
	}
	public normalized(): string {
		return this._value.trim().toLowerCase();
	}
	public ready(): boolean { return this._value.trim().toLowerCase() === 'ready'; }
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		return `${clean_prefix}: ${this.normalized()}`;
	}
	public contains_word(word: string): boolean {
		const normalized_word = word.trim().toLowerCase();
		const words = this.normalized().split(/\s+/u);
		return words.includes(normalized_word);
	}
	public report(): void {
		const fields = [
			this.normalized(),
			String(this.ready()),
			this.label("Current"),
			String(this.contains_word("ready")),
		];
		console.log(fields.join(" | "));
	}
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe('Status', () => {
	test('normalizes status text', () => {
		const status = new Status(' READY ');
		const normalized = status.normalized();
		expect(normalized).toBe('ready');
	});
	test('classifies a ready status', () => {
		const status = new Status('ready');
		const ready = status.ready();
		expect(ready).toBe(true);
	});
});
// File: cli.ts
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY value ');
	status.report();
})();
```
