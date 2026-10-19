# `missing-import`

Description: Restore an unresolved module or update the import to the module's current owner.

## Bad


```python
# File: src/service.py
from .not_found import Item  # <- error
class Service:
    def load(self) -> Item:
        return Item()
```

## Good


```python
# File: cli.py
from package.item import Item
if __name__ == "__main__":
    Item.load()
```
