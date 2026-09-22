# `python-object-setattr`

**Purpose:** `object.__setattr__` bypasses immutability and the normal object contract.

```py
object.__setattr__(self, "value", value)
```

**Fix:** Assign during construction or expose an explicit transition; do not bypass the contract.
