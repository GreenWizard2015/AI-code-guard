# `python-property-setter`

**Purpose:** Setters hide state transitions and weaken immutability.

```py
item.name = value
```

**Fix:** Return a new value or expose an explicit transition such as `with_name(value)`.
