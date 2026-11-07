# `test-min-size`

Description: Keep each Jest callback large enough to verify meaningful behavior. Count the callback plus logical body statements; blank lines and comments do not count.

## Bad

```ts
// File: src/domain/status.ts
export class Status {
	private readonly value: string;
	public constructor(value: string) { this.value = value; }
	public normalized(): string {
		return this.value.trim().toLowerCase();
	}
	public ready(): boolean {
		const normalized_value = this.normalized();
		const expected_value = 'ready';
		return normalized_value === expected_value;
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const status_value = this.normalized();
		return `${clean_prefix}: ${status_value}`;
	}
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		const status_value = this.normalized();
		if (normalized_fragment.length === 0) {
			return false;
		}
		return status_value.includes(normalized_fragment);
	}
	public report(): void {
		const fields = [
			this.normalized(),
			String(this.ready()),
			this.label("State"),
			String(this.contains("ead")),
		];
		console.log(fields.join(" | "));
	}
}
// File: tests/domain/status.test.ts
import { Status } from "src/domain/status";
describe("Status", () => {
	test("constructs a status", () => {}); // <- error
	test("classifies ready", () => { const status = new Status("ready"); expect(status.ready()).toBe(true); });
});
// File: cli.ts
#!/usr/bin/env node
import { Status } from 'src/domain/status';
(function () {
	const status = new Status(' READY ');
	status.report();
})();
```

## Good

```ts
// File: src/domain/status.ts
export class Status {
	private readonly _value: string;
	private readonly _normalized_values: Map<string, string>;
	public constructor(value: string) {
		this._value = value;
		this._normalized_values = new Map();
	}
	public normalized(): string {
		const cached_value = this._normalized_values.get(this._value);
		if (cached_value !== undefined) {
			return cached_value;
		}
		const normalized_value = this._value.trim().toLowerCase();
		this._normalized_values.set(this._value, normalized_value);
		return normalized_value;
	}
	public ready(): boolean {
		const normalized_value = this.normalized();
		const expected_value = 'ready';
		return normalized_value === expected_value;
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const status_value = this.normalized();
		return `${clean_prefix}: ${status_value}`;
	}
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		const status_value = this.normalized();
		if (normalized_fragment.length === 0) {
			return false;
		}
		return status_value.includes(normalized_fragment);
	}
	public report(): void {
		const fields = [
			this.normalized(),
			String(this.ready()),
			this.label("State"),
			String(this.contains("ead")),
		];
		console.log(fields.join(" | "));
	}
}
// File: tests/domain/status.test.ts
import { Status } from 'src/domain/status';
describe('Status', () => {
	test('normalizes a value', () => {
		const status = new Status(' READY ');
		const value = status.normalized();
		expect(value).toBe('ready');
	});
	test('classifies ready', () => {
		const status = new Status('ready');
		const value = status.ready();
		expect(value).toBe(true);
	});
});
// File: cli.ts
#!/usr/bin/env node
import { Status } from 'src/domain/status';
(function () {
	const status = new Status(' READY ');
	status.report();
})();
```
