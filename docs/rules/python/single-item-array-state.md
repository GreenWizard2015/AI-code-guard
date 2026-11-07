# `single-item-array-state`

Description: Do not represent a nullable result as a single-item list. The rule catches indexing on known single-item list results and one-element sequence unpacking, including argument collections.

**Bad:**


### Replacement

**Fix:** Return an explicit state contract, such as `FoundService | MissingService`, and let each state own its behavior.


The rule reports any element access on a locally declared function, method, or arrow function whose declared result is an array. It also reports a local value assigned from `[0]` and immediately guarded against `undefined`. In Python, the equivalent is a locally declared function or method returning `list[T]` or `List[T]` and then accessed by index. Real collection processing should use a named collection contract and explicit collection operations rather than using an indexed access as a missing-value state.

```python
def find_service() -> list[Service]:
    return []

service = find_service()[0]
```

## Bad


```python
# File: src/item_directory.py
class ItemDirectory:
    def __init__(self, items: list[str]) -> None:
        self._items: list[str] = items

    def records_for_directory(self) -> list[str]:
        return self._items[:1]

    def item_count(self) -> int:
        return len(self._items)

    def directory_label(self) -> str:
        return ", ".join(self._items)

    def report(self) -> None:
        item, = self.records_for_directory()  # <- error
        print(f"{self.directory_label()}: {item} ({self.item_count()} items)")
# File: cli.py
from src.item_directory import ItemDirectory

if __name__ == "__main__":
    directory = ItemDirectory(["item"])
    directory.report()
```

## Good


```python
# File: src/item_lookup_result.py
class ItemLookupResult:
    """A single lookup outcome with an explicit availability state."""

    def __init__(self, item_id: str, label: str, present: bool) -> None:
        self._item_id: str = item_id
        self._label: str = label
        self._present: bool = present

    def item_present(self) -> bool:
        return self._present

    def display_label(self) -> str:
        if not self._present:
            return "unavailable"
        return self._label.strip()

    def summary(self) -> str:
        return f"{self._item_id} (present={self.item_present()}): {self.display_label()}"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.item_lookup_result import ItemLookupResult

if __name__ == "__main__":
    result = ItemLookupResult("owner-17", "Ada", True)
    result.report()
```
