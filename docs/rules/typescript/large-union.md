# `large-union`

Description: Too many alternatives make a value contract ambiguous.

```ts
type Result = A | B | C | D;
```

Python annotations with the same number of alternatives are also reported:


Fix: Introduce a focused discriminated type or protocol.

## Bad

```ts
// File: src/types.ts
export type Result = First | Second | Third | Fourth;
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

