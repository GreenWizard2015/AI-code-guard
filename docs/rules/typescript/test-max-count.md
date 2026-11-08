# `test-max-count`

Description: Each Jest `describe` suite may contain at most fifteen test cases. Count each row in a static `test.each([...])` table as a separate case. Split larger suites by cohesive behavior.


Fix: Split the suite by cohesive behavior. Do not keep unrelated tests in one `describe` block.

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
	public report(): void {
		const normalized_status = this.normalized();
		const is_ready = this.ready();
		const current_label = this.label("Current");
		const has_ready_word = this.contains_word("ready");
		const report_fields = [normalized_status, String(is_ready), current_label, String(has_ready_word)];
		const report_line = report_fields.join(" | ");
		console.log(report_line);
	}
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe("Status", () => {
{% for index in range(16) %}
	test('case {{ index }}', () => {
		const status = new Status(`value {{ index }}`);
		expect(status.ready()).toBe(false);
	});
{% endfor %}
});
// File: src/cli.ts
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY value ');
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
	public report(): void {
		const normalized_status = this.normalized();
		const is_ready = this.ready();
		const current_label = this.label("Current");
		const has_ready_word = this.contains_word("ready");
		const report_fields = [normalized_status, String(is_ready), current_label, String(has_ready_word)];
		const report_line = report_fields.join(" | ");
		console.log(report_line);
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
// File: src/cli.ts
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY value ');
	status.report();
})();
```
