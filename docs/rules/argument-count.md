# `argument-count`

**Purpose:** Too many positional arguments make boundary contracts fragile.

```ts
function send(a: A, b: B, c: C, d: D, e: E, f: F): void {}
```

**Fix:** Introduce a named, validated options object.

