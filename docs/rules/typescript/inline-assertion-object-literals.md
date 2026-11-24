# `inline-assertion-object-literals`

Description: Inline object literals in equality assertions when temporary names exist only for the comparison.

## Bad

```ts
// File: tests/status.test.ts
describe("status", () => {
	test("matches the expected status", () => {
		const actual = { status: "ready" };
		const expected = { status: "ready" };
		expect(actual).toEqual(expected);
	});
});
```

## Good

```ts
// File: tests/status.test.ts
describe("status", () => {
	test("matches the expected status", () => {
		expect({ status: "ready" }).toEqual({ status: "ready" });
	});
});
```
