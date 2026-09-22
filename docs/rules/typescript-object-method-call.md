# `typescript-object-method-call`

**Purpose:** Indirect `.call` invocation obscures the receiver and contract.

```ts
Object.prototype.hasOwnProperty.call(value, key)
```

**Fix:** Use a typed helper or a direct, contract-specific operation.
