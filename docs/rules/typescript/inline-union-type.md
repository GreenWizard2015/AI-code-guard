# `inline-union-type`

Description: Anonymous literal unions hide finite value contracts in signatures and fields.

```ts
type AstCallableReference = { kind: 'function' | 'method'; };
```


Fix: Declare `type CallableKind = 'function' | 'method'` and use `CallableKind`.

## Bad

```ts
// File: src/protocols.ts
export interface CallableContract {
	invoke(kind: "function" | "method"): string;
}
```

## Good

```ts
// File: src/types.ts
export type CallableKind = "function" | "method";
// File: src/protocols.ts
import type { CallableKind } from "src/types";
export interface CallableContract { invoke(kind: CallableKind): string; }
```
