# `field-in-constructor`

Description: Object fields must be declared separately and initialized in the constructor.
This applies to TypeScript `new` expressions and Python constructor or factory
calls in class fields.


```python
class ImportResolver:
    cache = Map()
```

Declare the field first, then initialize it in `constructor`, `__init__`, or
`__post_init__`.

## Bad


```python
class Service:
    _client = Client()
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
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    owner = StatusLabels({"ready": "Ready"}, "Unknown")
    print(owner.label("ready"))
    print(owner.label_with_prefix("State", "ready"))
    print(owner.uppercase_fallback())
    print(owner.status_count())
```
