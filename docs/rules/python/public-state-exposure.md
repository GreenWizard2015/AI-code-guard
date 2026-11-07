# public-state-exposure

Description: An implementation class must not expose mutable collection state directly.

## Bad


```python
# File: src/registry.py
class Registry:
    def __init__(self, items: dict[str, str]) -> None:
        self.items: dict[str, str] = items

    def report(self) -> None:
        labels = list(self.items.values())
        print(", ".join(labels))
# File: cli.py
from src.registry import Registry

if __name__ == "__main__":
    registry = Registry({"primary": "ready"})
    registry.report()
```

Make the collection private or protected and expose a read-only view or a
method that owns mutations. The rule ignores `readonly` fields, private and
protected fields, interfaces, protocols, and data contracts.

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

    def report(self) -> None:
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        fallback = self.uppercase_fallback()
        print(f"{label} {detailed} {fallback}")
# File: cli.py
from src.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    status_labels.report()
```
