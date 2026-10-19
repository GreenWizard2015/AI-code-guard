# `module-constants-separation`

Description: Module-level constants must be separated from implementation code in every ordinary file.
Move them to the exact sibling `constants.ts` or `constants.py`, or to one focused file when
the constants belong together.

Do not keep module-level constants beside implementation code.

## Bad

```ts
const DEFAULT_LIMIT = 10;
export class Service {}
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

