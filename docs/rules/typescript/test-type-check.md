# `test-type-check`

Description: Tests must prove behavior, not identify runtime types. A type is not behavior: knowing that a value is a `Widget` does not show what the program did with it. Assert the returned value, state change, emitted event, or other observable effect instead.

## Bad

```ts
test("returns a result", () => {
	const result = service.run();
	expect(result).toBeInstanceOf(Success);
});
```

```ts
test("returns a result", () => {
	const result = service.run();
	if (typeof result === "object") {
		expect(result.value).toBe(3);
	}
});
```

## Good

```ts
test("returns a result", () => {
	const result = service.run();
	expect(result.value).toBe(3);
});
```

The rule reports runtime type probes such as `typeof`, `instanceof`, `Array.isArray`, Jest `toBeInstanceOf`, and Jest `expect.any(...)`. It does not prohibit static annotations or TypeScript type queries.
