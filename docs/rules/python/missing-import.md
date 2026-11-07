# `missing-import`

Description: Replace an unresolved import with the module that owns the symbol.

## Bad

```python
# File: src/catalog_item.py
class CatalogItem:
    """Responsibilities: _catalog item data and presentation_."""

    def __init__(self, label: str, category: str) -> None:
        self._label: str = label
        self._category: str = category

    def heading(self) -> str:
        return f"{self._category.upper()}: {self._label.strip()}"

    def word_count(self) -> int:
        word_count = 0
        for word in self._label.split():
            if len(word) > 0:
                word_count += 1
        return word_count

    def description(self) -> str:
        heading = self.heading()
        return f"{heading} ({self.word_count()} words)"
    def report(self) -> None:
        print(self.description())
# File: cli.py
try:
    from src.catalog_entry import CatalogItem  # <- error
except ImportError:
    from src.catalog_item import CatalogItem

if __name__ == "__main__":
    item = CatalogItem("item loaded", "catalog")
    item.report()
```

## Good

```python
# File: src/catalog_item.py
class CatalogItem:
    """Responsibilities: _catalog item data and presentation_."""

    def __init__(self, label: str, category: str) -> None:
        self._label: str = label
        self._category: str = category

    def heading(self) -> str:
        return f"{self._category.upper()}: {self._label.strip()}"

    def word_count(self) -> int:
        word_count = 0
        for word in self._label.split():
            if len(word) > 0:
                word_count += 1
        return word_count

    def description(self) -> str:
        heading = self.heading()
        return f"{heading} ({self.word_count()} words)"
    def report(self) -> None:
        print(self.description())
# File: cli.py
from src.catalog_item import CatalogItem

if __name__ == "__main__":
    item = CatalogItem("item loaded", "catalog")
    item.report()
```
