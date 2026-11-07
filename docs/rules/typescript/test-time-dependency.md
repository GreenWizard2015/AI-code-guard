# test-time-dependency

Description: Replace direct clock, sleep, and unseeded-random calls in unit tests with injected
deterministic sources; keep real-clock checks at explicit integration boundaries.

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
	public report(): void {
		console.log(this.normalized(), this.ready(), this.label('State'), this.contains('ead'));
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
// File: src/cli.ts
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
	public report(): void {
		console.log(this.normalized(), this.ready(), this.label('State'), this.contains('ead'));
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
// File: src/cli.ts
#!/usr/bin/env node
import { Status } from 'src/domain/status';
(function () {
	const status = new Status(' READY ');
	status.report();
})();
```

