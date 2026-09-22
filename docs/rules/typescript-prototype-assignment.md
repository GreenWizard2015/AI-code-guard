# `typescript-prototype-assignment`

**Purpose:** Prototype mutation obscures class ownership and invariants.

```ts
User.prototype.load = function () { /* ... */ };
```

**Fix:** Declare `class User` and place `load()` in its body.
