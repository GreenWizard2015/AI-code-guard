# `test-type-check`

Description: Tests must prove behavior, not identify runtime types. A type is not behavior: knowing that a value is a `Widget` does not show what the program did with it. Assert the returned value, state change, emitted event, or other observable effect instead.

## Bad

```ts
// File: src/success.ts
export class Success {
	private readonly _value: number;
	public constructor(value: number) { this._value = value; }
	public value(): number { return this._value; }
}
// File: src/type_check.ts
import { Success } from "src/success";
export class TypeCheck {
	public run(): Success { return new Success(3); }
	public doubled(): number { return this.run().value() * 2; }
	public description(): string { return `value=${this.run().value()}`; }
	public positive(): boolean { return this.run().value() > 0; }
	public report(): void { console.log(this.description(), this.doubled(), this.positive()); }
}
// File: tests/type_check.test.ts
import { Success } from "src/success";
import { TypeCheck } from "src/type_check";
describe("TypeCheck", () => {
	test("returns a success result", () => {
		expect(new TypeCheck().run() instanceof Success).toBe(true);
	});
	test("doubles the result value", () => {
		expect(new TypeCheck().doubled()).toBe(6);
	});
});
// File: cli.ts
import { TypeCheck } from "src/type_check";
const service = new TypeCheck();
service.report();
```

```ts
// File: src/success.ts
export class Success {
	private readonly _value: number;
	public constructor(value: number) { this._value = value; }
	public value(): number { return this._value; }
}
// File: src/type_check.ts
import { Success } from "src/success";
export class TypeCheck {
	public run(): Success { return new Success(3); }
	public doubled(): number { return this.run().value() * 2; }
	public description(): string { return `value=${this.run().value()}`; }
	public positive(): boolean { return this.run().value() > 0; }
	public report(): void { console.log(this.description(), this.doubled(), this.positive()); }
}
// File: tests/type_check.test.ts
import { Success } from "src/success";
import { TypeCheck } from "src/type_check";
describe("TypeCheck", () => {
	test("returns an object result", () => {
		expect(typeof new TypeCheck().run()).toBe("object");
	});
	test("doubles the result value", () => {
		expect(new TypeCheck().doubled()).toBe(6);
	});
});
// File: cli.ts
import { TypeCheck } from "src/type_check";
const service = new TypeCheck();
service.report();
```

## Good

```ts
// File: src/domain/type_check.ts
export class TypeCheck {
	private readonly _value: number;
	private readonly _cache: Map<string, number>;
	public constructor(value: number) { this._value = value; this._cache = new Map(); }
	public run(): number {
		const cached = this._cache.get("run");
		if (cached !== undefined) { return cached; }
		const result = Math.max(0, this._value);
		this._cache.set("run", result);
		return result;
	}
	public doubled(): number { return this.run() * 2; }
	public description(): string { return `value=${this.run()}`; }
	public positive(): boolean { return this.run() > 0; }
	public report(): void { console.log(this.description(), this.doubled(), this.positive()); }
}
// File: tests/domain/type_check.test.ts
import { TypeCheck } from "src/domain/type_check";
describe("TypeCheck", () => {
	test("returns the expected value", () => {
		const service = new TypeCheck(3);
		const result = { value: service.run(), doubled: service.doubled() };
		expect(result).toEqual({ value: 3, doubled: 6 });
	});
	test("doubles the result value", () => {
		const service = new TypeCheck(4);
		const result = { doubled: service.doubled(), positive: service.positive() };
		expect(result).toEqual({ doubled: 8, positive: true });
	});
});
// File: cli.ts
import { TypeCheck } from "src/domain/type_check";
(() => { const service = new TypeCheck(3); service.report(); })();
```

The rule reports runtime type probes such as `typeof`, `instanceof`, `Array.isArray`, Jest `toBeInstanceOf`, and Jest `expect.any(...)`. It does not prohibit static annotations or TypeScript type queries.
