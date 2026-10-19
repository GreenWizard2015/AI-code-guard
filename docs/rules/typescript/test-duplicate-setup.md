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
		const normalized = this.normalized();
		return `${prefix.trim()}: ${normalized}`;
	}
	public contains(fragment: string): boolean {
		const value = fragment.trim().toLowerCase();
		const normalized = this.normalized();
		if (value.length === 0) { return false; }
		return normalized.includes(value);
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
// File: cli.ts
#!/usr/bin/env node
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY ');
	const output = [status.normalized(), status.ready(), status.label('State'), status.contains('ead')];
	console.log(output);
})();
```

