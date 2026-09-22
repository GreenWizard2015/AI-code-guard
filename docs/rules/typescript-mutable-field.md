# `typescript-mutable-field`

**Purpose:** Unnecessary TypeScript field mutation increases lifecycle coupling.

```ts
class Cache { public value: Result | null = null; }
```

**Fix:** Prefer `readonly` and return updated state; keep mutation only when it is intentional.
