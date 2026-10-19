# `naming-type`

Description: Name type declarations with PascalCase and without underscores.

## Bad


```python
# File: src/types.py
from typing import TypeAlias

item_count: TypeAlias = int
```

## Good


```python
# File: src/types.py
from typing import TypeAlias

ItemCount: TypeAlias = int
# File: cli.py
from src.types import ItemCount

if __name__ == "__main__":
    item_count: ItemCount = 3
    print(item_count)
```
