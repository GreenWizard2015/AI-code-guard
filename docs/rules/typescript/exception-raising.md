# `exception-raising`

Description: Keep test control flow explicit without exceptions.

The rule reports TypeScript `throw` and Python `raise` only in files identified as tests by their filename. A support module under `tests/` is not a test file by location alone.


Fix: Return an explicit result or handle failure without an exception.
Do not use `raise` or `throw` in tests.

## Bad

```ts
// File: tests/domain/reader.test.ts
describe("reader", () => {
	test("rejects invalid data", () => {
		throw new Error("invalid data"); // <- error
	});
});
```


## Good

```ts
// File: cli.ts
#!/usr/bin/env node
(function () { try { read(); } catch (error) { console.error(error); } })();
```

