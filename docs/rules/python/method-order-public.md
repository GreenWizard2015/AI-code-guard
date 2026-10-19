# `method-order-public`

Description: Declare public methods after private and protected implementation methods.

## Bad


```python
class LabelOrder:
    def label(self) -> str:
        return "ready"

    def _normalize(self) -> str:
        return "ready"
```

## Good


```python
# File: src/label_order/label_order.py
class LabelOrder:
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
from label_order.label_order import LabelOrder

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    label_order = LabelOrder(labels, "Unknown")
    label = label_order.label("ready")
    detailed = label_order.label_with_prefix("State", "blocked")
    fallback = label_order.uppercase_fallback()
    count = label_order.status_count()
    print(f"{label} {detailed} {fallback} {count}")
```
