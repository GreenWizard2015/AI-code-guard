# `reexports`

**Purpose:** Re-exporting imported symbols obscures the defining module.

Before:

```ts
// feature.ts
export { Client } from 'src/client';
export type { ClientOptions } from 'src/client';
```

```ts
// caller.ts
import { Client } from 'src/feature';
```

After:

```ts
// caller.ts
import { Client } from 'src/client';
```

**Fix:** Import `Client` from its defining module at the use site. Update all callers before removing a facade, and keep an entry-point export only when it is part of the intentional external API.

Registry example:

```ts
// Before: types.ts owns unrelated types and re-exports the registry.
export { ToolRegistry } from 'src/registry';
```

```ts
// After: callers use the defining owner.
import { ToolRegistry } from 'src/registry';
```

Do not preserve an internal compatibility alias just to avoid updating callers.
The rule also rejects type-only re-exports; import the type from its defining module instead.
