# `unused-constant`

Description: Reports a module-level constant with no production symbol usage. Remove dead
configuration or vocabulary, or add a real production consumer.

## Bad

```ts
// File: constants.ts
export const READ_FAILURE_MESSAGE = "request failed"; // <- error
```


## Good

```ts
// File: constants.ts
export const READ_FAILURE_MESSAGE = "request failed";
// File: cli.ts
#!/usr/bin/env node
import { READ_FAILURE_MESSAGE } from "constants";
(function () {
	console.log(READ_FAILURE_MESSAGE);
})();
```

