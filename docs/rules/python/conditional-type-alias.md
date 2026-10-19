# `conditional-type-alias`

Description: See the examples below for the rule behavior.

## Bad

```python
# File: src/types.py
from typing import TypeAlias

if True:
    InputValue: TypeAlias = str | int
# File: cli.py
from src.types import InputValue

if __name__ == "__main__":
    value: InputValue = "ready"
    print(value)
```

Define type aliases unconditionally. Type-shaped assignments inside any conditional branch are
reported; ordinary runtime assignments in branches remain allowed.

## Good

```python
# File: src/types.py
from typing import TypeAlias

InputValue: TypeAlias = str | int
# File: cli.py
from src.types import InputValue

if __name__ == "__main__":
    value: InputValue = "ready"
    print(value)
```
