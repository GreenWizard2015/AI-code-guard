# `type-factory`

Description: `namedtuple`, `NamedTuple`, `TypedDict`, and `NewType` can hide project-owned models.

```python
user_type = NamedTuple("User", [("id", str)])
```


Fix: Declare an explicit dataclass or normal class with typed fields.

## Bad

```python
# File: cli.py
from typing import NamedTuple

User = NamedTuple("User", [("user_id", str)])

if __name__ == "__main__":
    print(User("user-1").user_id)
```

## Good

```python
# File: cli.py
if __name__ == "__main__":
    print("ready")
```
