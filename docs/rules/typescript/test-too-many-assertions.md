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
// File: cli.ts
#!/usr/bin/env node
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY ');
	const output = [status.normalized(), status.ready(), status.label('State'), status.contains('ead')];
	console.log(output);
})();
```


## Good

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
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe('Status', () => {
	test('normalizes a value', () => { const status = new Status(' READY '); expect(status.normalized()).toBe('ready'); });
	test('classifies readiness', () => { const status = new Status('ready'); expect(status.ready()).toBe(true); });
});
// File: cli.ts
#!/usr/bin/env node
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY ');
	const output = [status.normalized(), status.ready(), status.label('State'), status.contains('ead')];
	console.log(output);
})();
```

