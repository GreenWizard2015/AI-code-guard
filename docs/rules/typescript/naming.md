# `naming`

Description: Consistent names improve searchability across Python and TypeScript.

Fix: Use `snake_case`, at most three words, for functions, methods, variables, and fields. Use `PascalCase` without underscores for classes, interfaces, enums, and named type aliases.

The same method rule applies to methods declared in project interfaces. External runtime API names remain boundary exceptions.

## Bad

```ts
// File: cli.ts
(function () {
	const itemCount = 1; // <- error
	console.log(itemCount);
})();
```


## Good

```ts
// File: cli.ts
(function () {
	const item_count = 1;
	console.log(item_count);
})();
```

