# `dynamic-type`

**Purpose:** Runtime-built project classes hide their contract.

```py
user_type = type("User", (Base,), {"load": load})
```

**Fix:** Declare a normal class with explicit fields and methods.
