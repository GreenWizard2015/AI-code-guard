# `python-data-class-method`

**Purpose:** Keep Python dataclasses focused on state. They must not become holders of business
logic.

```py
from dataclasses import dataclass

@dataclass
class User:
    name: str

    def normalize(self) -> str:  # violation
        return self.name.strip()
```

Special methods such as `__str__` and `__post_init__` are allowed. Abstract base classes are
covered by `python-abstract-class`; use a Protocol or interface for a contract instead.

**Fix:** Move behavior into a normal class that owns the logic and keep the dataclass as its data
value.
