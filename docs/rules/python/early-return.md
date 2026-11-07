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
    def report(self) -> None:
        print(f"{self.label('ready')} {self.label_with_prefix('State', 'blocked')} {self.uppercase_fallback()}")

# File: cli.py
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = StatusLabels({}, "Unknown")
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
        normalized_status = status.strip().lower()
        if normalized_status in self._labels:
            selected_label = self._labels[normalized_status]
            return selected_label
        return self._fallback

    def label_with_prefix(self, prefix: str, status: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        normalized_prefix = prefix.strip()
        selected_label = self.label(status)
        prefix_label = normalized_prefix.upper()
        return f"{prefix_label}: {selected_label}"

    def uppercase_fallback(self) -> str:
        """Responsibilities: _fallback capitalization_."""
        words = self._fallback.strip().split()
        normalized = " ".join(words)
        capitalized = normalized.upper()
        return capitalized
    def report(self) -> None:
        """Responsibilities: _status label report output_."""
        ready_label = self.label("ready")
        blocked_label = self.label_with_prefix("State", "blocked")
        fallback_label = self.uppercase_fallback()
        report_line = " | ".join([ready_label, blocked_label, fallback_label])
        print(report_line)

# File: cli.py
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = StatusLabels({}, "Unknown")
    labels.report()
```
