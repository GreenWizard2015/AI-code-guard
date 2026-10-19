# `nested-import`

Description: Move imports from functions, methods, classes, and conditional blocks to module scope.

## Bad

```ts
namespace Feature {
	import Item = require("domain/item"); // <- error
}
```


## Good

```ts
import { Item } from "domain/item";
```

