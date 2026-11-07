# `mixed-module`

Description: Mixing ordinary classes and free functions blurs module ownership. Exception
classes may share a module with the parsing or validation functions that construct them.

Before:


## Bad


```python
# File: src/status_labels/status_labels.py
def normalize_label(value: str) -> str:
    return value.strip().lower()


class StatusLabels:
    def __init__(self, fallback: str) -> None:
        self._fallback: str = fallback

    def has_status(self, status: str) -> bool:
        return len(normalize_label(status)) > 0

    def label(self, status: str) -> str:
        if not self.has_status(status):
            return self._fallback
        normalized_status = normalize_label(status)
        return normalized_status

    def report(self) -> None:
        print(self.label(" READY "))
# File: cli.py
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = StatusLabels("unknown")
    labels.report()
```

**Fix:** Split responsibilities into existing focused owners, or choose one ownership model for the module. Do not create a tiny wrapper module solely to move a function.

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
    def report(self) -> None:
        """Responsibilities: _status report output_."""
        ready_label = self.label("ready")
        blocked_label = self.label_with_prefix("State", "blocked")
        print(f"{ready_label} | {blocked_label} | {self.uppercase_fallback()} | {self.status_count()}")
# File: cli.py
from src.status_labels.status_labels import StatusLabels
if __name__ == "__main__":
    status_labels = StatusLabels({"ready": "Ready", "blocked": "Blocked"}, "Unknown")
    status_labels.report()
```
