# `data-class-method`

Description: Keep Python dataclasses focused on state. They must not become holders of business
logic.

```python
from dataclasses import dataclass

@dataclass
class User:
    name: str

    def normalize(self) -> str:  # violation
        return self.name.strip()
```

Special methods such as `__str__` and `__post_init__` are allowed. Abstract base classes are
covered by `python-abstract-class`; use a Protocol or interface for a contract instead.


Fix: Move behavior into a normal class that owns the logic and keep the dataclass as its data
value.

## Bad

```python
from dataclasses import dataclass

@dataclass
class User:
    name: str

    def normalize(self) -> str:
        return self.name.strip()
```

## Good

```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
