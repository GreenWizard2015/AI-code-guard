# `jest-describe-count`

Description: Each Jest file must contain exactly one top-level `describe` block.

## Bad

```ts
// File: src/documentation/status.ts
export class Status {
	private readonly value: string;
	public constructor(value: string) {
		this.value = value;
	}
	public normalized(): string {
		let normalized_value = "";
		let pending_space = false;
		for (const character of this.value.trim()) {
			if (/\s/u.test(character)) {
				pending_space = normalized_value.length > 0;
				continue;
			}
			if (pending_space) { normalized_value += " "; }
			normalized_value += character.toLowerCase();
			pending_space = false;
		}
		return normalized_value;
	}
	public ready(): boolean {
		const normalized_value = this.normalized();
		const readiness_status = normalized_value === "ready";
		return readiness_status;
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		const normalized_value = this.normalized();
		const status_label = `${clean_prefix}: ${normalized_value}`;
		return status_label;
	}
	public contains_word(word: string): boolean {
		const normalized_word = word.trim().toLowerCase();
		const normalized_value = this.normalized();
		const words = normalized_value.split(/\s+/u);
		let matched = false;
		for (const candidate of words) {
			if (candidate === normalized_word) { matched = true; }
		}
		return matched;
	}
	public report(): void {
		const status_label = this.label("Status");
		const ready_text = this.ready() ? "ready" : "pending";
		const has_ready_word = this.contains_word("ready");
		console.log(`${status_label} | ${ready_text} | ready word=${has_ready_word}`);
	}
}
// File: tests/documentation/status.test.ts
import { Status } from 'src/documentation/status';
describe("normalized status", () => {
	test("normalizes status text", () => {
		const status = new Status(" READY ");
		expect(status.normalized()).toBe("ready");
	});
});
describe("ready status", () => {
	test("classifies ready", () => {
		const status = new Status("ready");
		expect(status.ready()).toBe(true);
	});
});
// File: cli.ts
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status(' READY value ');
	status.report();
})();
```

## Good

```ts
// File: src/documentation/status.ts
/** Responsibilities: _status value interpretation and reporting_. **/
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
		return this.current_value().trim().toLowerCase().replace(/\s+/u, " ");
	}
	public ready(): boolean {
		return this.normalized() === 'ready';
	}
	public label(prefix: string): string {
		const clean_prefix = prefix.trim();
		return `${clean_prefix}: ${this.normalized()}`;
	}
	public contains_word(word: string): boolean {
		return this.normalized().split(" ").includes(word.trim().toLowerCase());
	}
	public report(): void {
		const normalized_text = this.normalized();
		const ready_text = this.ready() ? 'Ready' : 'Not ready';
		const status_label = this.label('Status');
		const has_ready_word = this.contains_word('ready');
		console.log(`${normalized_text} | ${ready_text} | ${status_label} | contains ready=${has_ready_word}`);
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
// File: cli.ts
import { Status } from 'src/documentation/status';
(function () {
	const status = new Status("queued");
	status.change_value(' READY value ');
	status.report();
})();
```
