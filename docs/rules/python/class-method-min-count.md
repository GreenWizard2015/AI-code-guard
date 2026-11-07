# `class-method-min-count`

Description: Implementation classes need at least two meaningful methods. A class with fewer
methods should have a justified boundary; do not add placeholder methods to meet
the count.

## Bad


```python
# File: src/status_labels.py
class StatusLabels:
    def label(self) -> str:
        return "ready"

def report_status(status_labels: StatusLabels) -> None:
    print(f"status: {status_labels.label()}")
# File: cli.py
from src.status_labels import StatusLabels, report_status

if __name__ == "__main__":
    status_labels = StatusLabels()
    report_status(status_labels)
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

    def report_summary(self) -> None:
        """Responsibilities: _status summary reporting_."""
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        fallback = self.uppercase_fallback()
        count = self.status_count()
        print(f"{label} {detailed} {fallback} {count}")
# File: cli.py
from src.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    status_labels.report_summary()
```
