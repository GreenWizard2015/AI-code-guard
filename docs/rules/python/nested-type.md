# `nested-type`

Description: Type declarations must be top-level so their ownership and reuse remain visible.
The rule covers TypeScript type aliases, interfaces, and enums, plus Python `TypeAlias`,
`TypeAliasType`, and structural type declarations nested inside classes, functions, or other
scopes. Nested classes are reported separately by `nested-class`.

**Bad TypeScript:**


**Bad Python:**

```python
def create():
    LocalState: TypeAlias = str
    return "value"
```


Fix: Move each type declaration to a focused top-level module and import it where needed.

## Bad


```python
# File: cli.py
from typing import Literal, TypeAlias

if __name__ == "__main__":
    status: TypeAlias = Literal["ready", "blocked"]
    value: status = "ready"
    print(value)
```

## Good


```python
# File: src/types.py
from typing import Literal, TypeAlias

Status: TypeAlias = Literal["ready", "blocked"]
# File: cli.py
from typing import Literal, TypeAlias

from src.types import Status

if __name__ == "__main__":
    value: Status = "ready"
    print(value)
```
