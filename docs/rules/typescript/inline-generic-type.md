# `inline-generic-type`

Description: Anonymous generic arguments make nested contracts hard to read.

```ts
Promise<{ id: string }>
```

Python generic arguments should also use named contracts:


Fix: Name the result shape first, then use `Promise<Result>`.

## Bad

```ts
// File: cli.ts
function item_id(value: Promise<{ id: string }>): string {
	return "item";
}

(function () {
	console.log(item_id(Promise.resolve({ id: "item-1" })));
})();
```


## Good

```ts
// File: src/types.ts
export type Item = string;
// File: cli.ts
import type { Item } from "src/types";
(function () {
	const items: ReadonlyArray<Item> = ["one", "two"];
	console.log(items.length);
})();
```

