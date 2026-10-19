# functions-file-type-declaration

Description: Root `functions.ts` and `functions.py` files must not declare classes, standalone types, aliases, interfaces, enums, or structural type values. Free functions are reported by `functions-file-domain-class` and must move with their state into a focused domain class module.

Move each type description to its owning type module or class. Keep the functions file focused on the small callable boundary; do not hide a type declaration in a namespace, nested scope, alias, or wrapper.

## Bad


```python
# File: functions.py
from typing import TypeAlias

ServiceState: TypeAlias = str
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
