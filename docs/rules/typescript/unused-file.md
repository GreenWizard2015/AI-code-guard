# `unused-file`

Description: Remove an unused source file or add a real production or test import for it.

## Bad

```ts
// File: src/unused_notes.ts
export interface UnusedNote {
	label: string;
}
// File: src/status.ts
export class Status {
	private readonly status: string;

	public constructor(status: string) {
		this.status = status;
	}

	public normalized_status(): string {
		return this.status.trim().toLowerCase();
	}

	public status_label(): string {
		return `Status: ${this.normalized_status()}`;
	}

	public report(): void {
		console.log(this.status_label());
	}
}
// File: cli.ts
import { Status } from "src/status";
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
	public constructor(value: string) { this._value = value; }
	public normalized(): string {
		return this._value.trim().toLowerCase();
	}
	public ready(): boolean {
		const expected_value = 'ready';
		return this._value.trim().toLowerCase() === expected_value;
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
		console.log(`${this.label("State")} | ${this.ready()} | ${this.contains("ead")}`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { Status } from "src/domain/status";
(function () {
	const status = new Status(' READY ');
	status.report();
})();
```

