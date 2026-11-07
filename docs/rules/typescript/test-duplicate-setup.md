# `test-duplicate-setup`

Description: Remove repeated identical setup statements from one test.

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
		const normalized = this.normalized();
		return `${prefix.trim()}: ${normalized}`;
	}
	public contains(fragment: string): boolean {
		const value = fragment.trim().toLowerCase();
		const normalized = this.normalized();
		if (value.length === 0) { return false; }
		return normalized.includes(value);
	}
	public report(): void {
		const normalized_status = this.normalized();
		const is_ready = this.ready();
		const status_label = this.label('State');
		const has_fragment = this.contains('ead');
		const report_fields = [normalized_status, String(is_ready), status_label, String(has_fragment)];
		const report_line = report_fields.join(' | ');
		console.log(report_line);
	}
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe('Status', () => {
	test('normalizes an input', () => {
		let status: Status;
		status = new Status(' READY ');
		status = new Status(' READY '); // <- error
		const normalized = status.normalized();
		expect(normalized).toBe('ready');
	});
	test('classifies readiness', () => {
		const status = new Status('ready');
		const ready = status.ready();
		expect(ready).toBe(true);
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
		const normalized = this.normalized();
		return `${prefix.trim()}: ${normalized}`;
	}
	public contains(fragment: string): boolean {
		const value = fragment.trim().toLowerCase();
		const normalized = this.normalized();
		if (value.length === 0) { return false; }
		return normalized.includes(value);
	}
	public report(): void {
		const normalized_status = this.normalized();
		const is_ready = this.ready();
		const status_label = this.label('State');
		const has_fragment = this.contains('ead');
		const report_fields = [normalized_status, String(is_ready), status_label, String(has_fragment)];
		const report_line = report_fields.join(' | ');
		console.log(report_line);
	}
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe('Status', () => {
	test('normalizes an input', () => {
		const status = new Status(' READY ');
		const normalized = status.normalized();
		expect(normalized).toBe('ready');
	});
	test('classifies readiness', () => {
		const status = new Status('ready');
		const ready = status.ready();
		expect(ready).toBe(true);
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

