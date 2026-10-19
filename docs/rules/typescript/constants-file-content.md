# `constants-file-content`

Description: Files named `constants.ts` or `constants.py` contain constant values only. Keep
classes, functions, and types in their focused implementation or contract files.

## Bad

```ts
// File: src/constants.ts
export class Service {
	public run(): string { return "ready"; }
}
```


## Good

```ts
// File: src/constants.ts
export const DEFAULT_LIMIT = 10;
// File: cli.ts
import { DEFAULT_LIMIT } from "src/constants";

(function () {
	console.log(DEFAULT_LIMIT);
})();
```

