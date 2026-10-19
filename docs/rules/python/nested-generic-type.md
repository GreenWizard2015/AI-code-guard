# `nested-generic-type`

Description: Name nested generic applications at a contract boundary. For example, prefer
`Promise<Result>` or `list[Result]` to nested generic types that conceal several
representations in one signature.

## Bad


```python
# File: cli.py
def lookup_result(values: list[dict[str, str]]) -> str:
    return values[0]["value"]

if __name__ == "__main__":
    print(lookup_result([{"value": "ready"}]))
```

## Good


```python
# File: src/types.py
from typing import TypeAlias

Item: TypeAlias = str
# File: cli.py
from src.types import Item
if __name__ == "__main__":
    items: list[Item] = ["ready"]
    print(len(items))
```
