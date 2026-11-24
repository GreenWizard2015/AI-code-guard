# `inline-assertion-object-literals`

Description: Inline object literals in equality assertions when temporary names exist only for the comparison.

## Bad

```ts
// File: src/domain/status.ts
export class Status {
	private readonly _value: string;
	private readonly _cache: Map<string, string>;
	public constructor(value: string) { this._value = value; this._cache = new Map(); }
	public normalized(): string {
		const cached = this._cache.get(this._value);
		if (cached !== undefined) { return cached; }
		const normalized = this._value.trim().toLowerCase();
		this._cache.set(this._value, normalized);
		return normalized;
	}
	public ready(): boolean { return this.normalized() === "ready"; }
	public label(): string { return `Status: ${this.normalized()}`; }
	public contains(fragment: string): boolean { return this.normalized().includes(fragment); }
	public report(): void { console.log(this.label(), this.ready(), this.contains("ready")); }
}
// File: tests/domain/status.test.ts
import { Status } from "src/domain/status";
describe("Status", () => {
	test("normalizes status", () => {
		const status = new Status(" READY ");
		const normalized = status.normalized();
		const actual = { status: normalized };
		const expected = { status: "ready" };
		expect(actual).toEqual(expected);
		expect(status.ready()).toBe(true);
	});
	test("labels status", () => {
		const status = new Status("ready");
		const label = status.label();
		const actual = { label };
		const expected = { label: "Status: ready" };
		expect(actual).toEqual(expected);
		expect(status.contains("ready")).toBe(true);
	});
});
// File: cli.ts
import { Status } from "src/domain/status";
(() => { const status = new Status(" READY "); status.report(); })();
```

## Good

```ts
// File: src/domain/status.ts
export class Status {
	private readonly _value: string;
	private readonly _cache: Map<string, string>;
	public constructor(value: string) { this._value = value; this._cache = new Map(); }
	public normalized(): string {
		const cached = this._cache.get(this._value);
		if (cached !== undefined) { return cached; }
		const normalized = this._value.trim().toLowerCase();
		this._cache.set(this._value, normalized);
		return normalized;
	}
	public ready(): boolean { return this.normalized() === "ready"; }
	public label(): string { return `Status: ${this.normalized()}`; }
	public contains(fragment: string): boolean { return this.normalized().includes(fragment); }
	public report(): void { console.log(this.label(), this.ready(), this.contains("ready")); }
}
// File: tests/domain/status.test.ts
import { Status } from "src/domain/status";
describe("Status", () => {
	test("normalizes status", () => {
		const status = new Status(" READY ");
		const result = { status: status.normalized(), ready: status.ready(), label: status.label() };
		expect(result).toEqual({ status: "ready", ready: true, label: "Status: ready" });
	});
	test("labels status", () => {
		const status = new Status("ready");
		const result = { contains: status.contains("ready"), label: status.label(), normalized: status.normalized() };
		expect(result).toEqual({ contains: true, label: "Status: ready", normalized: "ready" });
	});
});
// File: cli.ts
import { Status } from "src/domain/status";
(() => { const status = new Status(" READY "); status.report(); })();
```
