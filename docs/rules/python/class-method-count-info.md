# `class-method-count-info`

Description: Review an implementation class when it has more than five public methods. This
is informational: check whether the API represents one cohesive responsibility.

## Bad


```python
# File: src/status_labels.py
class StatusLabels:
    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        self._labels: dict[str, str] = labels
        self._fallback: str = fallback
    def label(self, status: str) -> str:
        if status in self._labels:
            return self._labels[status]
        return self._fallback
    def label_with_prefix(self, prefix: str, status: str) -> str:
        label = self.label(status)
        return f"{prefix}: {label}"
    def uppercase_fallback(self) -> str:
        normalized = self._fallback.strip()
        uppercase = ""
        for character in normalized:
            uppercase += character.upper()
        return uppercase
    def status_count(self) -> int:
        count = 0
        for status_name in self._labels:
            if status_name:
                count += 1
        return count
    def contains_status(self, status: str) -> bool:
        return status in self._labels
    def first_status(self) -> str:
        for status_name in self._labels:
            return status_name
        return self._fallback
    def status_from_row(self, row: str) -> str:
        fields = row.split(",")
        return fields[0]
# File: cli.py
from status_labels import StatusLabels

if __name__ == "__main__":
    status_labels = StatusLabels({"ready": "Ready"}, "Unknown")
    label = status_labels.label("ready")
    detailed = status_labels.label_with_prefix("State", "ready")
    fallback = status_labels.uppercase_fallback()
    count = status_labels.status_count()
    contains = status_labels.contains_status("ready")
    first = status_labels.first_status()
    parsed = status_labels.status_from_row("ready,Ready")
    print(f"{label} {detailed} {fallback} {count} {contains} {first} {parsed}")
```

## Good


```python
# File: src/status_labels/status_labels.py
class StatusLabels:
    """Responsibilities: _status label mapping_."""

    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        """Responsibilities: _mapping initialization_."""
        self.labels: dict[str, str] = labels
        self.fallback: str = fallback
    def label(self, status: str) -> str:
        """Responsibilities: _status label selection_."""
        if status in self.labels:
            return self.labels[status]
        return self.fallback
    def label_with_prefix(self, prefix: str, status: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        label = self.label(status)
        return f"{prefix}: {label}"
    def uppercase_fallback(self) -> str:
        """Responsibilities: _fallback capitalization_."""
        normalized = self.fallback.strip()
        return normalized.upper()
    def status_count(self) -> int:
        """Responsibilities: _mapping size reporting_."""
        count = 0
        for status_name in self.labels:
            if status_name:
                count += 1
        return count
# File: cli.py
from status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    label = status_labels.label("ready")
    detailed = status_labels.label_with_prefix("State", "blocked")
    fallback = status_labels.uppercase_fallback()
    count = status_labels.status_count()
    print(f"{label} {detailed} {fallback} {count}")
```
