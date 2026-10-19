# `nested-generic-type`

Description: Name nested generic applications at a contract boundary. For example, prefer
`Promise<Result>` or `list[Result]` to nested generic types that conceal several
representations in one signature.

## Bad

```ts
// File: cli.ts
function lookup_result(value: Promise<Array<Result>>): string {
	return "ready";
}

(function () {
	console.log(lookup_result(Promise.resolve([])));
})();
```


## Good

```ts
// File: src/types.ts
export type Item = string;
// File: cli.ts
import type { Item } from "src/types";
(function () {
	const items: ReadonlyArray<Item> = ["ready"];
	console.log(items.length);
})();
```

