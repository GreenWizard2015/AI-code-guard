# `naming-type`

Description: Name type declarations with PascalCase and without underscores.

## Bad

```ts
// File: src/types.ts
export type item_count = number;
```


## Good

```ts
// File: src/types.ts
export type ItemCount = number;
// File: cli.ts
import type { ItemCount } from "src/types";

(function () {
	const item_count: ItemCount = 3;
	console.log(item_count);
})();
```

