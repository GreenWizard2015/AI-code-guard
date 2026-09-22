# `singleton`

**Purpose:** A module-level class instance creates hidden global state.

```ts
export const CLIENT = new Client();
```

**Fix:** Construct dependencies at the composition root and inject them into consumers.
