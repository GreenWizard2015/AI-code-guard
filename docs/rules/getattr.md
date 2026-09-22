# `getattr`

**Purpose:** Dynamic lookup used for normal control flow bypasses the object contract.

```py
value = getattr(item, "name", None)
```

**Fix:** Use an explicit attribute or a typed boundary helper.

