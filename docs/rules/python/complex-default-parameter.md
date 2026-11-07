# `complex-default-parameter`

Description: Parameter defaults must not allocate dependencies or mutable state before the
caller's lifecycle is explicit. Avoid objects, factories, callbacks, and mutable
collections as defaults. Primitive literal defaults such as strings are allowed.

## Bad

```python
# File: src/status_labels.py
class StatusLabels:
    def __init__(self, labels: dict[str, str] = {"ready": "Ready"}, fallback: str = "Unknown") -> None:  # <- error
        self._labels: dict[str, str] = labels
        self._fallback: str = fallback

    def label(self, status: str) -> str:
        label = self._labels.get(status)
        if label is None:
            return self._fallback
        return label

    def label_with_prefix(self, prefix: str, status: str) -> str:
        label = self.label(status)
        return f"{prefix}: {label}"

    def uppercase_fallback(self) -> str:
        normalized = self._fallback.strip()
        return normalized.upper()

    def status_count(self) -> int:
        count = 0
        for status_name in self._labels:
            if status_name:
                count += 1
        return count

    def report(self) -> None:
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "ready")
        fallback = self.uppercase_fallback()
        count = self.status_count()
        print(f"{label} {detailed} {fallback} {count}")
# File: cli.py
from src.status_labels import StatusLabels

if __name__ == "__main__":
    status_labels = StatusLabels()
    status_labels.report()
```

## Good

```python
# File: src/status_labels.py
class StatusLabels:
    """Responsibilities: _status label mapping_."""

    def __init__(self, labels: dict[str, str], fallback: str = "Unknown") -> None:
        """Responsibilities: _mapping initialization_."""
        self._labels: dict[str, str] = labels
        self._fallback: str = fallback

    def label(self, status: str) -> str:
        """Responsibilities: _status label selection_."""
        label = self._labels.get(status)
        if label is None:
            return self._fallback
        return label

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
        """Responsibilities: _status report output_."""
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        fallback = self.uppercase_fallback()
        count = self.status_count()
        print(f"{label} {detailed} {fallback} {count}")
# File: cli.py
from src.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels)
    status_labels.report()
```
