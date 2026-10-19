# `large-union`

Description: Too many alternatives make a value contract ambiguous.


Python annotations with the same number of alternatives are also reported:

```python
def read(value: A | B | C | D) -> A:
    return value
```


Fix: Introduce a focused discriminated type or protocol.

## Bad


```python
# File: cli.py
def select_result(value: First | Second | Third | Fourth) -> str:
    return str(value)

if __name__ == "__main__":
    print(select_result("first"))
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
