# `switch`

**Purpose:** `switch` in TypeScript and `match`/`case` in Python distribute dispatch behavior
across cases and make branch ownership harder to follow.

```ts
switch (kind) {
  case 'created':
    handle_created();
    break;
}
```

```py
match kind:
    case 'created':
        handle_created()
```

**Fix:** Use a dictionary or table keyed by the discriminant and dispatch through the selected
entry. Keep explicit conditions when the branches are not a stable keyed dispatch.
