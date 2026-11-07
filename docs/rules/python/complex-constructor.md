# `complex-constructor`

Description: Constructors should establish a valid object by assigning ready values and
dependencies. Move I/O, parsing, and calls to the object’s own behavior into a
named operation that can run after construction.

## Bad


```python
# File: src/document_loader/document_loader.py
class DocumentLoader:
    def __init__(self, source: str) -> None:
        self.source: str = source
        self.document: str = self._parse_source()

    def _parse_source(self) -> str:
        return self.source.strip()

    def report(self) -> None:
        loaded_document = self.document
        print(loaded_document)
# File: cli.py
from src.document_loader.document_loader import DocumentLoader

if __name__ == "__main__":
    loader = DocumentLoader(" ready document ")
    loader.report()
```

## Good


```python
# File: src/status_labels/status_labels.py
class StatusLabels:
    """Responsibilities: _status label mapping_."""

    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        """Responsibilities: _mapping initialization_."""
        self._labels: dict[str, str] = labels
        self._fallback: str = fallback

    def label(self, status: str) -> str:
        """Responsibilities: _status label selection_."""
        if status in self._labels:
            return self._labels[status]
        return self._fallback

    def label_with_prefix(self, prefix: str, status: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        label = self.label(status)
        return f"{prefix}: {label}"

    def uppercase_fallback(self) -> str:
        """Responsibilities: _fallback capitalization_."""
        normalized = self._fallback.strip()
        return normalized.upper()

    def status_count(self) -> int:
        """Responsibilities: _mapping size reporting_."""
        count = 0
        for status_name in self._labels:
            if status_name:
                count += 1
        return count

    def report(self) -> None:
        """Responsibilities: _status overview reporting_."""
        ready = self.label("ready")
        blocked = self.label_with_prefix("State", "blocked")
        fallback = self.uppercase_fallback()
        count = self.status_count()
        print(f"{ready}; {blocked}; {fallback}; {count} statuses")
# File: cli.py
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    status_labels.report()
```
