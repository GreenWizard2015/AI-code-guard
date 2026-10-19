# `branch-duplication`

Description: Avoid an `if`/`elif` chain that compares the same identifier against several
values and repeats the same kind of branch. Use a lookup keyed by that value
when it expresses the mapping directly.

## Bad

The class examples below isolate the repeated branch in a real caller and show the same mapping
before and after replacing it with a lookup.


```python
# File: src/status_labels/status_labels.py
class StatusLabels:

    def __init__(self, fallback: str) -> None:
        self.fallback: str = fallback

    def label(self, status: str) -> str:
        if status == "ready":  # <- error
            return "Ready"
        elif status == "blocked":
            return "Blocked"
        elif status == "complete":
            return "Complete"
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
    labels = StatusLabels("Unknown")
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
        """Responsibilities: _fallback normalization_."""
        normalized = self.fallback.strip()
        return normalized.upper()
# File: cli.py
from status_labels.status_labels import StatusLabels
if __name__ == "__main__":
    status_labels = StatusLabels({"ready": "Ready", "blocked": "Blocked", "complete": "Complete"}, "Unknown")
    label = status_labels.label("ready")
    detailed = status_labels.label_with_prefix("State", "blocked")
    print(label, detailed, status_labels.uppercase_fallback())
```
