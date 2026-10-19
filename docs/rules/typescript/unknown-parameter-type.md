# `unknown-parameter-type`

Description: Do not accept TypeScript `unknown` as a parameter type.

## Bad

```ts
// File: src/value_parser.ts
class ValueParser {
	public parse(value: unknown): string { return String(value); }
}
```

Fix: Define the concrete input contract or a focused protocol at the boundary.

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
	console.log(value);
})();
```
