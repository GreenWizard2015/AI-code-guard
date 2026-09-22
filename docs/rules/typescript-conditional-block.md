# `typescript-conditional-block`

**Purpose:** Unbraced branches are easy to extend incorrectly.

```ts
if (ready) send();
```

**Fix:** Always use braces: `if (ready) { send(); }`.

