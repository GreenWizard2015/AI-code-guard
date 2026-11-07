# `nested-import`

Description: Move imports from functions, methods, classes, and conditional blocks to module scope.

## Bad


```python
# File: src/item.py
class Item:
    def __init__(self, label: str) -> None:
        self._label: str = label
        self._category: str = "catalog"
        self._identifier: str = "item-1"

    def normalized_label(self) -> str:
        return "-".join(self._label.lower().split())

    def category_label(self) -> str:
        category = self._category.strip()
        if not category:
            return "UNCATEGORIZED"
        return category.upper()

    def description(self) -> str:
        return f"{self._identifier}: {self.category_label()} {self.normalized_label()}"
# File: src/item_reporter.py
class ItemReporter:
    """Responsibilities: _item label reporting_."""

    def __init__(self, prefix: str) -> None:
        """Responsibilities: _reporter initialization_."""
        self._prefix: str = prefix
        self._empty_label: str = "empty item"
        self._size_suffix: str = "characters"

    def resolve_name(self) -> str:
        """Responsibilities: _item description access_."""
        from src.item import Item  # <- error
        item = Item("loaded")
        return item.description()

    def format_label(self) -> str:
        """Responsibilities: _item label formatting_."""
        label = self.resolve_name()
        if not label:
            label = self._empty_label
        return f"{self._prefix.strip().upper()}: {label}"

    def report(self) -> None:
        """Responsibilities: _item label output_."""
        label = self.format_label()
        print(f"{label} ({len(label)} {self._size_suffix})")
# File: cli.py
from src.item_reporter import ItemReporter

if __name__ == "__main__":
    reporter = ItemReporter("State")
    reporter.report()
```

## Good


```python
# File: src/item.py
class Item:
    def __init__(self, label: str) -> None:
        self._label: str = label
        self._category: str = "catalog"
        self._identifier: str = "item-1"

    def normalized_label(self) -> str:
        return "-".join(self._label.lower().split())

    def category_label(self) -> str:
        category = self._category.strip()
        if not category:
            return "UNCATEGORIZED"
        return category.upper()

    def description(self) -> str:
        return f"{self._identifier}: {self.category_label()} {self.normalized_label()}"
# File: src/item_reporter.py
from src.item import Item

class ItemReporter:
    """Responsibilities: _item label reporting_."""

    def __init__(self, prefix: str) -> None:
        """Responsibilities: _reporter initialization_."""
        self._prefix: str = prefix
        self._empty_label: str = "empty item"
        self._size_suffix: str = "characters"

    def resolve_name(self) -> str:
        """Responsibilities: _item description access_."""
        item = Item("loaded")
        return item.description()

    def format_label(self) -> str:
        """Responsibilities: _item label formatting_."""
        label = self.resolve_name()
        if not label:
            label = self._empty_label
        return f"{self._prefix.strip().upper()}: {label}"

    def report(self) -> None:
        """Responsibilities: _item label output_."""
        label = self.format_label()
        print(f"{label} ({len(label)} {self._size_suffix})")
# File: cli.py
from src.item_reporter import ItemReporter

if __name__ == "__main__":
    reporter = ItemReporter("State")
    reporter.report()
```
