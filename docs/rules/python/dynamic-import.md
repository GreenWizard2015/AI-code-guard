# `dynamic-import`

Description: Use static imports for project-owned dependencies so the dependency graph and
module contract remain visible at analysis time.

## Bad


```python
# File: cli.py
import importlib

if __name__ == "__main__":
    module = importlib.import_module("src.item.item")
    print(module.Item)
```

## Good


```python
# File: src/types.py
from typing import Literal, TypeAlias

Status: TypeAlias = Literal["ready", "blocked"]
# File: cli.py
from src.types import Status

if __name__ == "__main__":
    status: Status = "ready"
    print(status)
```
