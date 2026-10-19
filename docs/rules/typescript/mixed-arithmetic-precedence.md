# `mixed-arithmetic-precedence`

Description: Split an arithmetic expression or add parentheses when it mixes `+`, `-`, `*`, `/`, `%`, `//`, and `**` in one ungrouped expression. Parentheses around a larger expression do not hide a mixed expression inside that group.

## Bad

```ts
(function () {
	const first = 12;
	const second = 3;
	const third = 2;
	const total = first + second / third;
	const delta = first + second - third;
	const remainder = first + second % third;
	const power = first * second ** third;
	console.log(`${total} ${delta} ${remainder} ${power}`);
})();
```


## Good

```ts
// File: cli.ts
(function () {
	const first = 12;
	const second = 3;
	const third = 2;
	const total = first + (second / third);
	const delta = (first + second) - third;
	const remainder = first + (second % third);
	const power = first * (second ** third);
	console.log(`${total} ${delta} ${remainder} ${power}`);
})();
```

