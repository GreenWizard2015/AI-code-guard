# `class-min-size`

Description: Implementation classes should contain enough real state or behavior to justify
their boundary. Inline a genuinely trivial class or give it a cohesive domain
responsibility; do not add padding methods or fields.

## Bad


```python
# File: src/status_labels.py
class StatusLabels:
    def label(self, status: str) -> str:
        print(f"status: {status}")
        return status
# File: cli.py
from src.status_labels import StatusLabels

if __name__ == "__main__":
    status_labels = StatusLabels()
    status_labels.label("ready")
```

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

    def status_count(self) -> int:
        """Responsibilities: _mapping size reporting_."""
        count = 0
        for status_name in self._labels:
            if status_name:
                count += 1
        return count

    def report(self, lines: list[str]) -> None:
        """Responsibilities: _status report output_."""
        print(" ".join(lines))
# File: cli.py
from src.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    label = status_labels.label("ready")
    detailed = status_labels.label_with_prefix("State", "blocked")
    fallback = status_labels.uppercase_fallback()
    count = status_labels.status_count()
    status_labels.report([label, detailed, fallback, str(count)])
```
