# `late-import`

Description: Keep static imports at the beginning of the file after the module docstring and future imports.

## Bad


```python
if is_ready():
    pass
from package.item import Item  # <- error
```

## Good


```python
from package.item import Item
Item.load()
```
