# `jest-test-ending`

Description: End each Jest test callback with its final `expect` assertion.

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
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe("Status", () => {
	test("normalizes status text", () => {
		const status = new Status(" READY ");
		expect(status.normalized()).toBe("ready");
		const ready = status.ready();
	});
	test("classifies ready", () => {
		const status = new Status("ready");
		expect(status.ready()).toBe(true);
	});
});
// File: cli.ts
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY value ');
	status.normalized();
	status.ready();
	status.label('Current');
	status.contains_word('ready');
})();
```

## Good

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
	status.normalized();
	status.ready();
	status.label('Current');
	status.contains_word('ready');
})();
```
