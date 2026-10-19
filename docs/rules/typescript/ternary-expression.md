# `ternary-expression`

Description: Dense conditional expressions hide state transitions.

```ts
const RESULT = ready ? load() : null;
```

## Bad

```ts
// File: cli.ts
(function () {
	const ready = true;
	const result = ready ? read_cache() : fetch_remote();
	console.log(result);
})();
```


**Fix:** Use explicit `if/else`; primitive-only ternaries are allowed by the rule.


## Good

```ts
// File: cli.ts
(function () {
	let result = "fallback";
	const ready = true;
	if (ready) {
		result = "loaded";
	}
	console.log(result);
})();
```

