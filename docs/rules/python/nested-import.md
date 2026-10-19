# `nested-import`

Description: Move imports from functions, methods, classes, and conditional blocks to module scope.

## Bad


```python
def load_item() -> None:
    from package.item import Item  # <- error
```

## Good


```python
from package.item import Item
Item.load()
```
