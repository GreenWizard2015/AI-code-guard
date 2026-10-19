# `missing-import`

Description: Restore an unresolved module or update the import to the module's current owner.

## Bad

```ts
// File: src/service.ts
import { Item } from "./not_found"; // <- error
export class Service {
	public load(): Item { return new Item(); }
}
```


## Good

```ts
// File: cli.ts
#!/usr/bin/env node
import { Item } from "domain/item";
Item.load();
```

