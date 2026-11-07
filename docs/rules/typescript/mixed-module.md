# `mixed-module`

Description: Mixing ordinary classes and free functions blurs module ownership. Jest test files must also keep module-level declarations out of test modules. Exception classes may share a module with the parsing or validation functions that construct them.

## Bad

```ts
// File: src/domain/status_labels.ts
function normalize_label(value: string): string {
	return value.trim().toLowerCase();
}

export class StatusLabels {
	private readonly fallback: string;

	public constructor(fallback: string) {
		this.fallback = fallback;
	}

	public has_status(status: string): boolean {
		return normalize_label(status).length > 0;
	}

	public label(status: string): string {
		if (!this.has_status(status)) {
			return this.fallback;
		}
		const normalized_status = normalize_label(status);
		return normalized_status;
	}

	public report(): void {
		console.log(this.label(" READY "));
	}
}
// File: tests/domain/status_labels.test.ts
import { StatusLabels } from 'src/domain/status_labels';
const expected_status = true;
describe('StatusLabels', () => {
	test('finds a status', () => {
		const labels = new StatusLabels('unknown');
		const found = labels.has_status('ready');
		expect(found).toBe(expected_status);
	});
	test('formats a label', () => {
		const labels = new StatusLabels('unknown');
		const label = labels.label('ready');
		expect(label).toBe('ready');
	});
	test('rejects an empty status', () => {
		const labels = new StatusLabels('unknown');
		const found = labels.has_status('');
		expect(found).toBe(false);
	});
});
// File: cli.ts
import { StatusLabels } from "src/domain/status_labels";
(function () {
	const labels = new StatusLabels("unknown");
	labels.report();
})();
```


**Fix:** Split responsibilities into existing focused owners, or choose one ownership model for the module. Do not create a tiny wrapper module solely to move a function.


## Good

```ts
// File: src/domain/status_labels.ts
/** Responsibilities: _status label mapping_. **/
export class StatusLabels {
	private readonly _labels: ReadonlyMap<string, string>;
	private readonly _fallback: string;
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this._labels = labels;
		this._fallback = fallback;
	}
	public label(status: string): string {
		const label = this._labels.get(status);
		if (label === undefined) {
			return this._fallback;
		}
		return label;
	}
	public label_with_prefix(prefix: string, status: string): string {
		const label = this.label(status);
		return `${prefix}: ${label}`;
	}
	public uppercase_fallback(): string {
		const normalized = this._fallback.trim();
		return normalized.toUpperCase();
	}
	public status_count(): number {
		let count = 0;
		for (const status_name of this._labels.keys()) {
			if (status_name.length > 0) {
				count += 1;
			}
		}
		return count;
	}
	public report(): void {
		const ready_label = this.label("ready");
		const blocked_label = this.label_with_prefix("State", "blocked");
		console.log(`${ready_label} | ${blocked_label} | ${this.uppercase_fallback()} | ${this.status_count()}`);
	}
}
// File: tests/domain/status_labels.test.ts
import { StatusLabels } from 'src/domain/status_labels';
describe('StatusLabels', () => {
	test('selects a label', () => {
		const labels = new StatusLabels(new Map([['ready', 'Ready']]), 'Unknown');
		const selected = labels.label('ready');
		expect(selected).toBe('Ready');
	});
	test('uses the fallback for a missing label', () => {
		const labels = new StatusLabels(new Map([['ready', 'Ready']]), 'Unknown');
		const selected = labels.label_with_prefix('State', 'blocked');
		expect(selected).toBe('State: Unknown');
	});
	test('reports the number of labels', () => {
		const labels = new StatusLabels(new Map([['ready', 'Ready']]), 'Unknown');
		const count = labels.status_count();
		expect(count).toBe(1);
	});
});
// File: cli.ts
import { StatusLabels } from "src/domain/status_labels";
(function () {
	const labels = new Map([["ready", "Ready"], ["blocked", "Blocked"]]);
	const status_labels = new StatusLabels(labels, "Unknown");
	status_labels.report();
})();
```
