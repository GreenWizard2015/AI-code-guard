# `tuple-type`

Description: Detect TypeScript tuple type contracts, including readonly and labelled tuples.

Tuples expose data through positional indexes. This makes a result harder to understand and
allows callers to depend on ordering instead of a named contract.

## Bad

```ts
// File: cli.ts
#!/usr/bin/env node
(function () {
	const coordinates: readonly [number, number] = [10, 20]; // <- error
	console.log(coordinates[0], coordinates[1]);
})();
```


## Good

```ts
// File: src/types.ts
export type Coordinates = ReadonlyArray<number>;
// File: src/cli.ts
#!/usr/bin/env node
import { Coordinates } from "src/types";
(function () {
	const coordinates: Coordinates = [10, 20];
	console.log(coordinates[0], coordinates[1]);
})();
```

