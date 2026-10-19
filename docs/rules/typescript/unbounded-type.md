# `unbounded-type`

Description: Do not use `any` or `unknown` in TypeScript, or `Any` in Python. The rule applies to
all type annotations recognized by the AST, including parameters, fields, return values, and
generic type positions.

**Bad:**

```ts
function read_value(value: unknown): any {
	return value;
}
```


Fix: Replace the unbounded type with a concrete domain type or focused protocol.

## Bad

```ts
function read(value: unknown): string { return value as string; }
```


## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
	console.log(value);
})();
```

