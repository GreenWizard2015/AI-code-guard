# `production-test-import`

Description: Production code must not import a module from `tests/`, `__tests__/`, or a test-named file.
Tests may import production code.

Move reusable code into a production module and import it from both sides. Keep test helpers and
fixtures as test-only dependencies.

## Bad


```python
# File: src/application.py
from tests.support import TestSupport  # <- error
# File: tests/support.py
class TestSupport:
    pass
```

## Good


```python
from package.item import Item
Item.load()
```
