# `setattr`

**Purpose:** Dynamic assignment hides which state changes.

```py
setattr(item, "name", value)
```

The equivalent TypeScript dynamic assignment is also rejected:

```ts
setattr(item, 'name', value);
```

**Fix:** Assign an explicit field or use a named state-transition method.
