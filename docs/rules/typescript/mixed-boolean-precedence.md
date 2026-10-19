# `mixed-boolean-precedence`

Description: Split a boolean expression or add parentheses when it mixes `&&`, `||`, and `!` in one ungrouped expression. The Python equivalents are `and`, `or`, and `not`. Also group negation before a comparison when its scope is not explicit.

## Bad

```ts
const ready = first && second || third;
const has_items = first || second || count > 0;
const different = !value === expected;
```


## Good

```ts
// File: cli.ts
(function () {
	const first = true;
	const second = false;
	const third = true;
	const value = "ready";
	const expected = "ready";
	const ready = first && (second || third);
	const different = !(value === expected);
	console.log(`${ready} ${different}`);
})();
```

