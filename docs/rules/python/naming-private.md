# `naming-private`

Description: Names must not begin with `_`.

Allowed exceptions:

- fields;
- private methods;
- names made only of underscores, such as `_` or `__`.

This applies to module-level symbols, parameters, types, classes, public and protected methods, and local variables. Do not hide a leading underscore behind an alias.

## Bad


```python
# File: src/item_reporter.py
class ItemReporter:
    def __init__(self, item_counts: list[int]) -> None:
        self._item_counts: list[int] = list(item_counts)
    def add_item(self, item_count: int) -> None:
        self._item_counts.append(item_count)
    def count_items(self) -> int:
        total = 0
        for item_count in self._item_counts:
            total += item_count
        return total
    def average_item_count(self) -> float:
        if not self._item_counts:
            return 0.0
        return self.count_items() / len(self._item_counts)
    def report_item_count(self) -> None:
        print(f"item count: {self.count_items()} (average {self.average_item_count()})")
# File: src/cli.py
from src.item_reporter import ItemReporter

if __name__ == "__main__":
    reporter = ItemReporter([])
    _item_count = 1
    reporter.add_item(_item_count)
    reporter.add_item(2)
    reporter.report_item_count()
```

## Good


```python
# File: src/item_reporter.py
class ItemReporter:
    def __init__(self, item_counts: list[int]) -> None:
        self._item_counts: list[int] = list(item_counts)
    def add_item(self, item_count: int) -> None:
        self._item_counts.append(item_count)
    def count_items(self) -> int:
        total = 0
        for item_count in self._item_counts:
            total += item_count
        return total
    def average_item_count(self) -> float:
        if not self._item_counts:
            return 0.0
        return self.count_items() / len(self._item_counts)
    def report_item_count(self) -> None:
        print(f"item count: {self.count_items()} (average {self.average_item_count()})")
# File: src/cli.py
from src.item_reporter import ItemReporter

if __name__ == "__main__":
    item_count: int = 1
    reporter = ItemReporter([])
    reporter.add_item(item_count)
    reporter.add_item(2)
    reporter.report_item_count()
```
