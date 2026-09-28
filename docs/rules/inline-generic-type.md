# `inline-generic-type`

**Purpose:** Anonymous generic arguments make nested contracts hard to read.

```ts
Promise<{ id: string }>
```

Python generic arguments should also use named contracts:

```py
list[dict[str, str]]
```

**Fix:** Name the result shape first, then use `Promise<Result>`.
