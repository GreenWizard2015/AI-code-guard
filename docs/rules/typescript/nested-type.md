# `nested-type`

Description: Type declarations must be top-level so their ownership and reuse remain visible.
The rule covers TypeScript type aliases, interfaces, and enums, plus Python `TypeAlias`,
`TypeAliasType`, and structural type declarations nested inside classes, functions, or other
scopes. Nested classes are reported separately by `nested-class`.

**Bad TypeScript:**

```ts
function create() {
  type LocalState = { ready: boolean };
  return {};
}
```

**Bad Python:**


Fix: Move each type declaration to a focused top-level module and import it where needed.

## Bad

```ts
// File: cli.ts
(function () {
	type LocalStatus = "ready" | "blocked";
	const value: LocalStatus = "ready";
	console.log(value);
})();
```


## Good

```ts
// File: src/types.ts
export type Status = "ready" | "blocked";
// File: cli.ts
import type { Status } from "src/types";

(function () {
	const value: Status = "ready";
	console.log(value);
})();
```

