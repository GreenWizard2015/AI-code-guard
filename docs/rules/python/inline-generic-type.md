# `inline-generic-type`

Description: Anonymous generic arguments make nested contracts hard to read.


Python generic arguments should also use named contracts:

```python
list[dict[str, str]]
```


Fix: Name the result shape first, then use `Promise<Result>`.

## Bad


```python
# File: src/item_reader.py
class ItemReader:
    def __init__(self, prefix: str) -> None:
        self._prefix: str = prefix

    def item_id(self, values: list[dict[str, str]]) -> str:
        first_value = values[0]
        item_id = first_value["id"]
        return item_id

    def format_item_id(self, item_id: str) -> str:
        normalized_id = item_id.strip()
        return f"{self._prefix}:{normalized_id}"

    def report(self) -> None:
        values = [{"id": "item-1"}]
        item_id = self.item_id(values)
        print(self.format_item_id(item_id))
# File: cli.py
from src.item_reader import ItemReader

if __name__ == "__main__":
    reader = ItemReader("item")
    reader.report()
```

## Good


```python
# File: src/types.py
ItemResult = dict[str, str]
# File: src/item_catalog.py
from src.types import ItemResult

class ItemCatalog:
    def __init__(self) -> None:
        self._items: dict[str, ItemResult] = {}

    def add_result(self, result: ItemResult) -> None:
        normalized_id = result["id"].strip().lower()
        normalized_name = result["name"].strip()
        stored_result = {"id": normalized_id, "name": normalized_name}
        self._items[normalized_id] = stored_result

    def summary(self) -> str:
        entries: list[str] = []
        for item_id, result in self._items.items():
            item_name = result["name"].strip()
            entries.append(f"{item_id}: {item_name}")
        return " | ".join(entries)

    def item_ids(self) -> list[str]:
        identifiers: list[str] = []
        for item_id in self._items.keys():
            identifiers.append(item_id)
        return identifiers

    def report(self) -> None:
        item_summary = self.summary()
        identifiers = self.item_ids()
        entry_count = len(identifiers)
        print(f"{entry_count} catalog entries ({', '.join(identifiers)}): {item_summary}")
# File: cli.py
from src.item_catalog import ItemCatalog

if __name__ == "__main__":
    catalog = ItemCatalog()
    catalog.add_result({"id": "item-1", "name": "Notebook"})
    catalog.add_result({"id": "item-2", "name": "Pen"})
    catalog.report()
```
