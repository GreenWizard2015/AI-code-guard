# `dynamic-type`

**Purpose:** Runtime-built project classes hide their contract.

```py
user_type = type("User", (Base,), {"load": load})
```

TypeScript runtime class construction is covered as well:

```ts
const User = type('User', {}, { load });
```

**Fix:** Declare a normal class with explicit fields and methods.
