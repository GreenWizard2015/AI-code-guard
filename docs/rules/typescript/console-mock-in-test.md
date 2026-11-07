# `console-mock-in-test`

Description: Do not mock console methods as a test assertion mechanism; assert observable results directly.

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
		const normalized_value = this.normalized();
		const readiness = this.ready();
		const status_label = this.label('State');
		const contains_marker = this.contains('ead');
		console.log(`${normalized_value} ${readiness} ${status_label} ${contains_marker}`);
	}
}
// File: tests/domain/status.test.ts
import { Status } from "src/domain/status";
describe("Status", () => {
	test("does not assert through a console mock", () => { const output = jest.spyOn(console, "log"); // <- error
		const status = new Status("ready"); status.report(); expect(status.ready()).toBe(true); expect(output).toHaveBeenCalled(); });
	test("normalizes a value", () => { const status = new Status(" QUEUED "); expect(status.normalized()).toBe("queued"); });
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
	private readonly _status_history: string[];
	private readonly _current_value: Map<string, string>;
	private current_value(): string {
		const value = this._current_value.get("value");
		if (value === undefined) {
			return "";
		}
		return value;
	}
	public constructor(value: string) {
		this._status_history = [value];
		this._current_value = new Map([["value", value]]);
	}

	public change_value(value: string): void {
		this._status_history.push(value);
		this._current_value.set("value", value);
	}

	public normalized(): string {
		return this.current_value().trim().toLowerCase();
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
		const normalized_value = this.normalized();
		const readiness = this.ready();
		const status_label = this.label('State');
		const contains_marker = this.contains('ead');
		console.log(`${normalized_value} ${readiness} ${status_label} ${contains_marker}`);
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
	const status = new Status("queued");
	status.change_value(' READY ');
	status.report();
})();
```
