# `facade-file-content`

Description: Facade files such as `index.ts` and `__init__.py` may contain imports and re-exports only.

## Bad


```python
# File: src/__init__.py
class StatusCatalog:
    def __init__(self, statuses: list[str]) -> None:
        self._statuses: tuple[str, ...] = tuple(statuses)

    def status_count(self) -> int:
        return len(self._statuses)

    def status_label(self) -> str:
        return ", ".join(self._statuses)

    def report(self) -> None:
        label = self.status_label()
        count = self.status_count()
        print(f"{label} ({count})")
# File: cli.py
from src import StatusCatalog

if __name__ == "__main__":
    catalog = StatusCatalog(["ready", "queued"])
    catalog.report()
```

## Good


```python
# File: src/__init__.py
from src.status_catalog import StatusCatalog
# File: src/status_catalog.py
class StatusCatalog:
    _status_separator: str = ", "
    _empty_label: str = "empty"

    def __init__(self, statuses: list[str]) -> None:
        self._status_text: str = self._status_separator.join(statuses)

    def status_values(self) -> list[str]:
        normalized_values: list[str] = []
        for status_value in self._status_text.split(self._status_separator[0]):
            normalized_value = status_value.strip().upper()
            if normalized_value:
                normalized_values.append(normalized_value)
        return normalized_values

    def status_count(self) -> int:
        return len(self.status_values())

    def status_label(self) -> str:
        normalized_values = self.status_values()
        if not normalized_values:
            return self._empty_label
        return self._status_separator.join(normalized_values)

    def first_status(self) -> str:
        normalized_values = self.status_values()
        if not normalized_values:
            return self._empty_label
        return normalized_values[0]

    def summary(self) -> str:
        label = self.status_label()
        count = self.status_count()
        first = self.first_status()
        return f"{label} ({count}; first={first})"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.status_catalog import StatusCatalog

if __name__ == "__main__":
    catalog = StatusCatalog(["ready", "queued"])
    catalog.report()
```
