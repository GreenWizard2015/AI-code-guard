# `production-test-import`

Description: Production code must not import a module from `tests/`, `__tests__/`, or a test-named file.
Tests may import production code.

Move reusable code into a production module and import it from both sides. Keep test helpers and
fixtures as test-only dependencies.

## Bad

```ts
// File: src/application.ts
import { TestSupport } from "../tests/support"; // <- error
// File: tests/support.ts
export class TestSupport {}
```


## Good

```ts
import { Item } from "domain/item";
```

