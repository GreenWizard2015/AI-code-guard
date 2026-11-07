# `inline-object-type`

Description: Give reusable object, callback, and return shapes names before using them in parameters, variables, assertions, or `as`/`satisfies` expressions. This includes multiline shapes.

## Bad

```ts
// File: src/record_catalog.ts
export class RecordCatalog {
	private readonly records: ReadonlyMap<string, string>;
	private readonly requested_identifier: string;
	public constructor(records: ReadonlyMap<string, string>, requested_identifier: string) {
		this.records = records;
		this.requested_identifier = requested_identifier;
	}
	public record_value(input: { identifier: string }): string {
		const identifier = input.identifier.trim().toLowerCase();
		const record = this.records.get(identifier);
		if (record === undefined) {
			return "missing";
		}
		return record.trim();
	}
	public record_count(): number {
		let count = 0;
		for (const value of this.records.values()) {
			const normalized_value = value.trim();
			if (normalized_value.length > 0) { count += 1; }
		}
		return count;
	}
	public report(): void {
		const record = this.record_value({ identifier: this.requested_identifier });
		const count = this.record_count();
		console.log(`${record} | ${count} records`);
	}
}
// File: cli.ts
import { RecordCatalog } from "src/record_catalog";
(function () {
	const records = new Map<string, string>();
	const identifier = "user-1";
	records.set(identifier, "Ada");
	const catalog = new RecordCatalog(records, identifier);
	catalog.report();
})();
```

## Good

```ts
// File: src/types.ts
export type RecordQuery = { identifier: string };
// File: src/record_catalog.ts
import type { RecordQuery } from "src/types";
export class RecordCatalog {
	private readonly _records: ReadonlyMap<string, string>;
	private readonly _requested_identifier: string;
	public constructor(records: ReadonlyMap<string, string>, requested_identifier: string) {
		this._records = records;
		this._requested_identifier = requested_identifier;
	}
	public record_value(input: RecordQuery): string {
		const identifier = input.identifier.trim().toLowerCase();
		const record = this._records.get(identifier);
		if (record === undefined) { return "missing"; }
		return record.trim();
	}
	public record_count(): number {
		let count = 0;
		for (const value of this._records.values()) {
			if (value.trim().length > 0) { count += 1; }
		}
		return count;
	}
	public report(): void {
		const record = this.record_value({ identifier: this._requested_identifier });
		const count = this.record_count();
		const details = `${record} | ${count} records`;
		console.log(details);
	}
}
// File: cli.ts
import { RecordCatalog } from "src/record_catalog";
(function () {
	const records = new Map<string, string>();
	const identifier = "user-1";
	records.set(identifier, "Ada");
	const catalog = new RecordCatalog(records, identifier);
	catalog.report();
})();
```
