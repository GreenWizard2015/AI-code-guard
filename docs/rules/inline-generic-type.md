# `inline-generic-type`

**Purpose:** Anonymous generic arguments make nested contracts hard to read.

```ts
Promise<{ id: string }>
```

**Fix:** Name the result shape first, then use `Promise<Result>`.

