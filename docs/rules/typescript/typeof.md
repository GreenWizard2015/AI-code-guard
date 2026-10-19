# `typeof`

Description: Validate values at a boundary and avoid repeated `typeof` checks in business logic.

## Bad

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
	const is_text = typeof value === "string" && typeof value !== "number";
	console.log(is_text);
})();
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
	const is_text = typeof value === "string";
	console.log(is_text);
})();
```
