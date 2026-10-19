# `inline-generic-type`

Description: Anonymous generic arguments make nested contracts hard to read.


Python generic arguments should also use named contracts:

```python
list[dict[str, str]]
```


Fix: Name the result shape first, then use `Promise<Result>`.

## Bad


```python
# File: cli.py
def item_id(values: list[dict[str, str]]) -> str:
    return values[0]["id"]

if __name__ == "__main__":
    print(item_id([{"id": "item-1"}]))
```

## Good


```python
# File: src/types.py
from typing import TypeAlias

Item: TypeAlias = str
# File: cli.py
from src.types import Item
if __name__ == "__main__":
    items: list[Item] = ["one", "two"]
    print(len(items))
```
