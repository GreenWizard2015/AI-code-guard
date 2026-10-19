# test-time-dependency

Description: Reports direct real-time, sleep, or unseeded-random calls in TypeScript Jest
tests and Python `test_*` functions. Inject a clock or deterministic random
source for unit tests. Integration tests that intentionally exercise a real
clock should be kept at an explicit integration boundary.

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
		return this.normalized() === 'ready';
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
}
// File: tests/domain/status.test.ts
import { Status } from "src/domain/status";
describe("Status", () => {
	test("uses the current time", () => {
		const now = Date.now(); // <- error
		const status = new Status(String(now));
		expect(status.normalized()).toBe(String(now).toLowerCase());
	});
	test("classifies ready", () => { const status = new Status("ready"); expect(status.ready()).toBe(true); });
});
// File: cli.ts
#!/usr/bin/env node
import { Status } from 'src/domain/status';
(function () {
	const status = new Status(' READY ');
	console.log(status.normalized(), status.ready(), status.label('State'), status.contains('ead'));
})();
```


## Good

```ts
// File: src/domain/status.ts
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
	const normalized = status.normalized();
	const ready = status.ready();
	const label = status.label('State');
	console.log(normalized, ready, label, status.contains('ead'));
})();
```

