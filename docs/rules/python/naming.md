# `naming`

Description: Consistent names improve searchability across Python and TypeScript.

Fix: Use `snake_case`, at most three words, for functions, methods, variables, and fields. Use `PascalCase` without underscores for classes, interfaces, enums, and named type aliases.

The same method rule applies to methods declared in project interfaces. External runtime API names remain boundary exceptions.

## Bad


```python
# File: src/item_inventory.py
class ItemInventory:
    """Responsibilities: _inventory reporting_."""

    def __init__(self, items: list[str]) -> None:
        """Responsibilities: _inventory initialization_."""
        self._items: list[str] = items

    def item_count(self) -> int:
        """Responsibilities: _item counting_."""
        return len(self._items)

    def summary(self) -> str:
        """Responsibilities: _inventory summary formatting_."""
        itemCount = self.item_count()  # <- error
        return f"Inventory contains {itemCount} items"

    def report(self) -> None:
        """Responsibilities: _inventory report output_."""
        print(self.summary())
# File: cli.py
from src.item_inventory import ItemInventory

if __name__ == "__main__":
    inventory = ItemInventory(["book", "pen"])
    inventory.report()
```

## Good


```python
# File: src/item_inventory.py
class ItemInventory:
    """Responsibilities: _inventory reporting_."""

    def __init__(self, items: list[str]) -> None:
        """Responsibilities: _inventory initialization_."""
        self._items: list[str] = items

    def item_count(self) -> int:
        """Responsibilities: _item counting_."""
        return len(self._items)

    def contains_item(self, item_name: str) -> bool:
        """Responsibilities: _inventory item membership_."""
        for current_item in self._items:
            if current_item == item_name:
                return True
        return False

    def first_item_label(self) -> str:
        """Responsibilities: _inventory first item label_."""
        if len(self._items) == 0:
            return "empty inventory"
        return self._items[0].strip()

    def summary(self) -> str:
        """Responsibilities: _inventory summary formatting_."""
        item_count = self.item_count()
        first_item = self.first_item_label()
        has_book = self.contains_item("book")
        return f"Inventory contains {item_count} items; first={first_item}; book={has_book}"

    def report(self) -> None:
        """Responsibilities: _inventory report output_."""
        print(self.summary())
# File: cli.py
from src.item_inventory import ItemInventory

if __name__ == "__main__":
    inventory = ItemInventory(["book", "pen"])
    inventory.report()
```
