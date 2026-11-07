# test-order-dependency

Description: Reports multiple Jest or Python test cases that mutate the same module-level
mutable collection. A local collection, a single test mutation, or ordinary
mock setup is not reported.

Create fresh state inside each test or reset shared state in explicit setup.
The rule reports a static order-dependency risk; it does not assume a specific
test runner execution order.

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
		const values = [
			this.normalized(),
			String(this.ready()),
			this.label("State"),
			String(this.contains("ead")),
		];
		console.log(values.join(" | "));
	}
}
// File: tests/domain/status.test.ts
import { Status } from "src/domain/status";
const shared_state = { sent_ids: [] as string[] };
describe("Status", () => {
	test("sends the first message", () => {
		shared_state.sent_ids.push("first"); // <- error
		const status = new Status("ready"); expect(status.ready()).toBe(true);
    });
	test("sends the second message", () => {
		shared_state.sent_ids.push("second"); // <- error
		const status = new Status("queued"); expect(status.ready()).toBe(false);
    });
});
// File: cli.ts
import { Status } from "src/domain/status";
(function () {
	const status = new Status(" READY ");
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
		const values = [
			this.normalized(),
			String(this.ready()),
			this.label("State"),
			String(this.contains("ead")),
		];
		console.log(values.join(" | "));
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

