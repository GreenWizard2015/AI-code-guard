# `large-union`

**Purpose:** Too many alternatives make a value contract ambiguous.

```ts
type Result = A | B | C | D;
```

Python annotations with the same number of alternatives are also reported:

```py
def read(value: A | B | C | D) -> A:
    return value
```

**Fix:** Introduce a focused discriminated type or protocol.
