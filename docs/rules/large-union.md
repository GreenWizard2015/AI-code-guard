# `large-union`

**Purpose:** Too many alternatives make a value contract ambiguous.

```ts
type Result = A | B | C | D;
```

**Fix:** Introduce a focused discriminated type or protocol.

