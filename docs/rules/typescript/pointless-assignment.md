# `pointless-assignment`

Description: A temporary assigned and immediately returned value adds indirection.

```ts
const BUILT_VALUE = build(input);
return BUILT_VALUE;
```

## Bad

```ts
// File: src/value_builder/value_builder.ts
export class ValueBuilder {
	public build(): string {
		const result = "ready";
		return result;
	}
}
```


**Fix:** Return `build(input)` directly unless the name is reused or documents a real transition.

The target diagnostic is demonstrated by the `result` assignment immediately returned above.

## Good

```ts
// File: cli.ts
(function () {
	const value = "ready";
	console.log(value);
})();
```

