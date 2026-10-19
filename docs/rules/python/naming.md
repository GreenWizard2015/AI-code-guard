# `naming`

Description: Consistent names improve searchability across Python and TypeScript.

Fix: Use `snake_case`, at most three words, for functions, methods, variables, and fields. Use `PascalCase` without underscores for classes, interfaces, enums, and named type aliases.

The same method rule applies to methods declared in project interfaces. External runtime API names remain boundary exceptions.

## Bad


```python
from typing import Protocol

class ItemCountContract(Protocol):
    def format_item_count(self, itemCount: int) -> str: ...  # <- error
```

## Good


```python
from typing import Protocol

class ItemCountContract(Protocol):
    def format_item_count(self, item_count: int) -> str: ...
```
