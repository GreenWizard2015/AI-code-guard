# `typescript-inline-union-type`

**Purpose:** Anonymous literal unions hide finite value contracts in signatures and fields.

```ts
type AstCallableReference = { kind: 'function' | 'method'; };
```

**Fix:** Declare `type CallableKind = 'function' | 'method'` and use `CallableKind`.
