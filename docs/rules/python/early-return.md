# `early-return`

Description: Prefer an early exit when both branches only return a value:

```text
if condition:
    return first
else:
    return second
```

## Bad


```python
# File: src/status_labels/status_labels.py
class StatusLabels:

    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        self.labels: dict[str, str] = labels
        self.fallback: str = fallback

    def label(self, status: str) -> str:
        if status in self.labels:
            return self.labels[status]
        else:  # <- error
            return self.fallback

    def label_with_prefix(self, prefix: str, status: str) -> str:
        label = self.label(status)
        return f"{prefix}: {label}"

    def uppercase_fallback(self) -> str:
        normalized = self.fallback.strip()
        return normalized.upper()

# File: cli.py
from status_labels.status_labels import StatusLabels
if __name__ == "__main__":
    labels = StatusLabels({}, "Unknown")
    label = labels.label("ready")
    detailed = labels.label_with_prefix("State", "blocked")
    print(label, detailed, labels.uppercase_fallback())
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

# File: cli.py
from status_labels.status_labels import StatusLabels
if __name__ == "__main__":
    labels = StatusLabels({}, "Unknown")
    label = labels.label("ready")
    detailed = labels.label_with_prefix("State", "blocked")
    print(label, detailed, labels.uppercase_fallback())
```
