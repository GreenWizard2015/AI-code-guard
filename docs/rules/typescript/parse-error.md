# `parse-error`

Description: Fix syntax errors before relying on structural lint diagnostics.

## Bad

```ts
const result: = "ready";
```


## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
