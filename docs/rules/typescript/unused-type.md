# `unused-type`

Description: Reports a type declaration with no production symbol usage. Test-only references
do not keep a production type alive.

## Bad

```ts
// File: types.ts
export type MessageStatus = "queued" | "delivered"; // <- error
```


## Good

```ts
// File: types.ts
export type MessageStatus = "queued" | "delivered";
// File: cli.ts
#!/usr/bin/env node
import type { MessageStatus } from "types";
(function () {
	const status: MessageStatus = "queued";
	console.log(status);
})();
```

