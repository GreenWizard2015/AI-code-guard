# `module-constant-case`

Description: Every TypeScript `const` declared at module level, including `export const`, must use
`UPPER_SNAKE_CASE`. Local constants are not covered by this rule.

## Bad

```ts
const value = externalInput;
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
