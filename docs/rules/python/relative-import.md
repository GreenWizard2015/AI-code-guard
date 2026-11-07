# `relative-import`

Description: Use one configured import base so moving a file does not change how its dependencies resolve.

Set the same root or `src` import base in the runtime, tests, and packaging configuration. Then use absolute package paths consistently; do not hide relative imports behind aliases or path mutations.

## Bad

```python
# File: src/catalog/item.py
class Item:
    def __init__(self, identifier: str, title: str) -> None:
        self._identifier: str = identifier
        self._title: str = title

    def normalized_title(self) -> str:
        words = self._title.strip().split()
        return " ".join(words).upper()

    def available(self) -> bool:
        return len(self.normalized_title()) > 0

    def label(self) -> str:
        title = self.normalized_title()
        if not title:
            return f"{self._identifier}: Untitled"
        return f"{self._identifier}: {title}"
# File: src/catalog/item_card.py
from .item import Item  # <- error
class ItemCard:
    def __init__(self, identifier: str, title: str) -> None:
        self._item: Item = Item(identifier, title)

    def display_name(self) -> str:
        return f"Catalog item: {self._item.label()}"

    def listed(self) -> bool:
        label = self.display_name()
        if len(label.strip()) == 0:
            return False
        return self._item.available()

    def report(self) -> None:
        print(self.summary())

    def summary(self) -> str:
        label = self.display_name()
        if self.listed():
            return f"{label} (listed)"
        return f"{label} (hidden)"
# File: cli.py
from src.catalog.item_card import ItemCard
if __name__ == "__main__":
    item_card = ItemCard("item-1", "Field Guide")
    item_card.report()
```

## Good

```python
# File: src/catalog/item.py
class Item:
    def __init__(self, identifier: str, title: str) -> None:
        self._identifier: str = identifier
        self._title: str = title

    def normalized_title(self) -> str:
        words = self._title.strip().split()
        return " ".join(words).upper()

    def available(self) -> bool:
        return len(self.normalized_title()) > 0

    def label(self) -> str:
        title = self.normalized_title()
        if not title:
            return f"{self._identifier}: Untitled"
        return f"{self._identifier}: {title}"
# File: src/catalog/item_card.py
from src.catalog.item import Item
class ItemCard:
    def __init__(self, identifier: str, title: str) -> None:
        self._item: Item = Item(identifier, title)

    def display_name(self) -> str:
        return f"Catalog item: {self._item.label()}"

    def listed(self) -> bool:
        label = self.display_name()
        if len(label.strip()) == 0:
            return False
        return self._item.available()

    def report(self) -> None:
        print(self.summary())

    def summary(self) -> str:
        label = self.display_name()
        if self.listed():
            return f"{label} (listed)"
        return f"{label} (hidden)"
# File: cli.py
from src.catalog.item_card import ItemCard
if __name__ == "__main__":
    item_card = ItemCard("item-1", "Field Guide")
    item_card.report()
```
