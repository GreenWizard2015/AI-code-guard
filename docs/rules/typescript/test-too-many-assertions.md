# `test-too-many-assertions`

Description: Split a test with more than five assertions into focused tests.

## Bad

```ts
// File: src/documentation/status.ts
export class Status {
	private readonly value: string;
	public constructor(value: string) { this.value = value; }
	public normalized(): string {
		return this.value.trim().toLowerCase();
	}
	public ready(): boolean {
		return this.normalized() === 'ready';
	}
	public label(prefix: string): string {
		const status_value = this.normalized();
		return `${prefix.trim()}: ${status_value}`;
	}
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		const status_value = this.normalized();
		if (normalized_fragment.length === 0) { return false; }
		return status_value.includes(normalized_fragment);
	}
	public report(): void {
		const normalized = this.normalized();
		const ready = this.ready();
		const label = this.label('State');
		const contains_fragment = this.contains('ead');
		const output = [normalized, ready, label, contains_fragment];
		console.log(output.join(' | '));
	}
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe('Status', () => {
	test('reports all status behavior', () => { // <- error
		const status = new Status(' READY ');
		const normalized = status.normalized();
		const ready = status.ready();
		const label = status.label('State');
		const contains = status.contains('ead');
		const empty = status.contains('');
		expect(normalized).toBe('ready');
		expect(ready).toBe(true);
		expect(label).toBe('State: ready');
		expect(contains).toBe(true);
		expect(empty).toBe(false);
		expect(ready).toBe(true);
	});
	test('normalizes another value', () => {
		const status = new Status('READY');
		const normalized = status.normalized();
		expect(normalized).toBe('ready');
	});
});
// File: src/cli.ts
#!/usr/bin/env node
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY ');
	status.report();
})();
```


## Good

```ts
// File: src/documentation/status.ts
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
		return this.normalized() === 'ready';
	}
	public label(prefix: string): string {
		const status_value = this.normalized();
		return `${prefix.trim()}: ${status_value}`;
	}
	public contains(fragment: string): boolean {
		const normalized_fragment = fragment.trim().toLowerCase();
		const status_value = this.normalized();
		if (normalized_fragment.length === 0) { return false; }
		return status_value.includes(normalized_fragment);
	}
	public report(): void {
		const normalized = this.normalized();
		const ready = this.ready();
		const label = this.label('State');
		const contains_fragment = this.contains('ead');
		const output = [normalized, ready, label, contains_fragment];
		console.log(output.join(' | '));
	}
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe('Status', () => {
	test('normalizes a value', () => { const status = new Status(' READY '); expect(status.normalized()).toBe('ready'); });
	test('classifies readiness', () => { const status = new Status('ready'); expect(status.ready()).toBe(true); });
});
// File: src/cli.ts
#!/usr/bin/env node
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY ');
	status.report();
})();
```

