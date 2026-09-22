# `local-inheritance`

**Purpose:** Inheriting from another project class couples ownership boundaries.

```py
class CachedClient(BaseClient): ...
```

**Fix:** Prefer composition and dependency injection; implement a protocol when a shared contract is needed.
