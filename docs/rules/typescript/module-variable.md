# `module-variable`

Description: TypeScript module-level `let` and `var` declarations are forbidden, including exported
declarations. Use an immutable module constant or move mutable state into an owning class.

## Bad

```ts
let request_count = 0;
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
