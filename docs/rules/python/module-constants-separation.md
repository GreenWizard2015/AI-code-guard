# `module-constants-separation`

Description: Module-level constants must be separated from implementation code in every ordinary file.
Move them to the exact sibling `constants.ts` or `constants.py`, or to one focused file when
the constants belong together.

Do not keep module-level constants beside implementation code.

## Bad

```python
# File: src/search_capacity.py
DEFAULT_LIMIT = 10  # <- error

class SearchCapacity:
    def __init__(self, scope_name: str, requested_limit: int) -> None:
        self._scope_name: str = scope_name
        self._requested_limit: int = requested_limit

    def effective_limit(self) -> int:
        return max(0, min(self._requested_limit, DEFAULT_LIMIT))

    def limit_label(self) -> str:
        return f"{self._scope_name}: {self.effective_limit()} items"

    def accepts(self, value: int) -> bool:
        return value <= self.effective_limit()

    def report(self) -> None:
        label = self.limit_label()
        accepted = self.accepts(4)
        print(f"{label} accepted={accepted}")
# File: cli.py
from src.search_capacity import SearchCapacity

if __name__ == "__main__":
    capacity = SearchCapacity("Search", 8)
    capacity.report()
```

## Good

```python
# File: src/constants.py
DEFAULT_LIMIT: int = 10
# File: src/search_capacity.py
from src.constants import DEFAULT_LIMIT

class SearchCapacity:
    def __init__(self, scope_name: str, requested_limit: int) -> None:
        self._scope_name: str = scope_name
        self._requested_limit: int = requested_limit

    def effective_limit(self) -> int:
        return max(0, min(self._requested_limit, DEFAULT_LIMIT))

    def limit_label(self) -> str:
        return f"{self._scope_name}: {self.effective_limit()} items"

    def accepts(self, value: int) -> bool:
        return value <= self.effective_limit()

    def report(self) -> None:
        label = self.limit_label()
        accepted = self.accepts(4)
        print(f"{label} accepted={accepted}")
# File: cli.py
from src.search_capacity import SearchCapacity

if __name__ == "__main__":
    capacity = SearchCapacity("Search", 8)
    capacity.report()
```
