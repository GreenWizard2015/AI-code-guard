# `pointless-assignment`

**Purpose:** A temporary assigned and immediately returned value adds indirection.

```ts
const BUILT_VALUE = build(input);
return BUILT_VALUE;
```

**Fix:** Return `build(input)` directly unless the name is reused or documents a real transition.
