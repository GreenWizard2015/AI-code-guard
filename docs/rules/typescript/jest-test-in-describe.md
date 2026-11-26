# `jest-test-in-describe`

Description: Declare every Jest `test(...)` and `it(...)` case inside a `describe(...)` suite. Both test-case names are allowed.

## Bad

```ts
// File: tests/example.test.ts
test("returns the value", () => { // <- error
	expect(read_value()).toBe("ready");
});
it("recognizes the value", () => { // <- error
	expect(read_value()).toBe("ready");
});
```

## Good

```ts
// File: src/documentation/jest-test-in-describe/status.ts
export class Status {
	private readonly _history: string[];
	private readonly _current_value: Map<string, string>;
	public constructor(value: string) {
		this._history = [value];
		this._current_value = new Map([["current", value]]);
	}
	public update(value: string): void {
		this._history.push(value);
		this._current_value.set("current", value);
	}
	public normalized(): string {
		const value = this._current_value.get("current");
		if (value === undefined) {
			return "";
		}
		return value.trim().toLowerCase();
	}
	public ready(): boolean {
		return this.normalized() === "ready";
	}
	public history_count(): number {
		let count = 0;
		for (const value of this._history) {
			if (value.length > 0) {
				count += 1;
			}
		}
		return count;
	}
	public report(): void {
		console.log(`${this.normalized()} (${this.history_count()})`);
	}
}
// File: tests/documentation/jest-test-in-describe/status.test.ts
import { Status } from "src/documentation/jest-test-in-describe/status";

describe("Status", () => {
	it("normalizes its value", () => {
		const status = new Status(" READY ");
		expect(status.normalized()).toBe("ready");
	});
	test("recognizes a ready value", () => {
		const status = new Status("ready");
		expect(status.ready()).toBe(true);
	});
});
// File: cli.ts
import { Status } from "src/documentation/jest-test-in-describe/status";
(function () {
	const status = new Status("ready");
	status.update("ready");
	status.ready();
	status.report();
})();
```
