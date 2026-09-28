# `empty-contract`

**Purpose:** A naming-only interface or protocol adds indirection without a contract.

```ts
interface Repository {}
```

An empty Python protocol is the same problem:

```py
class Repository(Protocol):
    pass
```

**Fix:** Add the smallest meaningful members or remove the abstraction.
