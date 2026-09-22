# `python-type-factory`

**Purpose:** `namedtuple`, `NamedTuple`, `TypedDict`, and `NewType` can hide project-owned models.

```py
user_type = NamedTuple("User", [("id", str)])
```

**Fix:** Declare an explicit dataclass or normal class with typed fields.
