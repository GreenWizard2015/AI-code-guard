# `dynamic-import`

Description: Use static imports for project-owned dependencies so the dependency graph and
module contract remain visible at analysis time.

## Bad

```ts
// File: cli.ts
(async function () {
	const module = await import("src/item");
	console.log(module.Item);
})();
```


## Good

```ts
// File: src/types.ts
export type Status = "ready" | "blocked";
// File: cli.ts
import type { Status } from "src/types";

(function () {
	const status: Status = "ready";
	console.log(status);
})();
```

