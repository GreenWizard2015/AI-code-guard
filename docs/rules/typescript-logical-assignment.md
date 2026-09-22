# `typescript-logical-assignment`

**Purpose:** Logical assignment hides a conditional state transition in TypeScript.

```ts
value ??= create_value();
cache ||= load_cache();
```

**Fix:** Use an explicit condition followed by an assignment. Keep the state transition visible.
