# `entry-point-function-count`

Description: A source file recognized as an entry point may contain at most one free function. Entry points are identified by a Python main guard or configured entry-file paths, not by their filenames. All other behavior belongs in focused domain classes. Class methods, nested functions, and an inline startup wrapper are not counted as additional free entry points.

Problem: an entry-point file contains more than one free function.

Hint: Keep at most one free function in the recognized entry-point file and move every other operation into focused domain classes.

## Bad


```python
# File: src/status_labels.py
class StatusLabels:
    def report(self, requested_status: str) -> None:
        print(requested_status)
# File: cli.py
from src.status_labels import StatusLabels

def start() -> None:
    StatusLabels().report("ready")

def load_configuration() -> None:
    StatusLabels().report("blocked")

def report_status() -> None:
    StatusLabels().report("missing")

if __name__ == "__main__":
    start()
```

## Good


```python
# File: src/status_labels.py
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

    def report(self, requested_status: str) -> None:
        print(self.label(requested_status))
# File: cli.py
from src.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    label = status_labels.label("ready")
    detailed = status_labels.label_with_prefix("State", "blocked")
    fallback = status_labels.uppercase_fallback()
    count = status_labels.status_count()
    status_labels.report(f"{label} {detailed} {fallback} {count}")
```
