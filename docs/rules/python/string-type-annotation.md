# `string-type-annotation`

Description: Python type annotations must use direct expressions instead of quoted strings.

## Bad

```python
# File: src/status_catalog.py
class StatusCatalog:
    _labels: "dict[str, str]"  # <- error: quoted field annotation
    _fallback: str
    _current_status: str

    def __init__(self, labels: dict[str, str], fallback: str, current_status: str) -> None:
        self._labels = dict(labels)
        self._fallback = fallback
        self._current_status = current_status

    def label(self) -> str:
        if self._current_status in self._labels:
            return self._labels[self._current_status]
        return self._fallback

    def label_with_prefix(self, prefix: str) -> str:
        return f"{prefix.strip()}: {self.label()}"

    def status_count(self) -> int:
        return len(self._labels)

    def report(self) -> None:
        label = self.label_with_prefix("State")
        count = self.status_count()
        print(f"{label} | {count} statuses")
# File: src/cli.py
from src.status_catalog import StatusCatalog

if __name__ == "__main__":
    catalog = StatusCatalog({"ready": "Ready", "blocked": "Blocked"}, "Unknown", "ready")
    catalog.report()
```

## Good

```python
# File: src/status_catalog.py
class StatusCatalog:
    _labels: dict[str, str]
    _fallback: str
    _current_status: str

    def __init__(self, labels: dict[str, str], fallback: str, current_status: str) -> None:
        self._labels = dict(labels)
        self._fallback = fallback
        self._current_status = current_status

    def label(self) -> str:
        if self._current_status in self._labels:
            return self._labels[self._current_status]
        return self._fallback

    def label_with_prefix(self, prefix: str) -> str:
        return f"{prefix.strip()}: {self.label()}"

    def status_count(self) -> int:
        return len(self._labels)

    def report(self) -> None:
        label = self.label_with_prefix("State")
        count = self.status_count()
        print(f"{label} | {count} statuses")
# File: src/cli.py
from src.status_catalog import StatusCatalog

if __name__ == "__main__":
    catalog = StatusCatalog({"ready": "Ready", "blocked": "Blocked"}, "Unknown", "ready")
    catalog.report()
```

Use an import or a module layout that makes the type name available directly.
