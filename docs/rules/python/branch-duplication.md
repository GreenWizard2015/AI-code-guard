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
    def report(self) -> None:
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        print(f"{label} | {detailed} | {self.uppercase_fallback()}")
# File: cli.py
from src.status_labels.status_labels import StatusLabels
if __name__ == "__main__":
    labels = StatusLabels("Unknown")
    labels.report()
```

## Good


```python
# File: src/status_labels/status_labels.py
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
        """Responsibilities: _fallback normalization_."""
        normalized = self._fallback.strip()
        return normalized.upper()
    def report(self) -> None:
        """Responsibilities: _status report composition_."""
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        print(f"{label} | {detailed} | {self.uppercase_fallback()}")
# File: cli.py
from src.status_labels.status_labels import StatusLabels
if __name__ == "__main__":
    status_labels = StatusLabels({"ready": "Ready", "blocked": "Blocked", "complete": "Complete"}, "Unknown")
    status_labels.report()
```
