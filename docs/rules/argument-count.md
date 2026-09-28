# `argument-count`

**Purpose:** Too many positional arguments make boundary contracts fragile.

```ts
function send(a: A, b: B, c: C, d: D, e: E, f: F): void {}
```

**Fix:** Introduce a named, validated options object.

```py
def send(first: A, second: B, third: C, fourth: D, fifth: E, sixth: F) -> None:
    pass
```
