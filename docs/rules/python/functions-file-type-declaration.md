# functions-file-type-declaration

Description: Root `functions.ts` and `functions.py` files must not declare classes, standalone types, aliases, interfaces, enums, or structural type values. Free functions are reported by `functions-file-domain-class` and must move with their state into a focused domain class module.

Move each type description to its owning type module or class. Keep the functions file focused on the small callable boundary; do not hide a type declaration in a namespace, nested scope, alias, or wrapper.

## Bad


```python
# File: functions.py
from typing import TypeAlias

ServiceState: TypeAlias = str  # <- error
# File: src/status_reporter.py
class StatusReporter:
    def __init__(self, state: str) -> None:
        self._state: str = state.strip()

    def normalized_state(self) -> str:
        return " ".join(self._state.split()).lower()

    def status_label(self) -> str:
        return f"Service {self._state.strip().capitalize()}"

    def active(self) -> bool:
        return self._state.strip().lower() == "ready"

    def state_length(self) -> int:
        return len(self._state.strip())

    def report(self) -> None:
        normalized = self.normalized_state()
        label = self.status_label()
        active = self.active()
        length = self.state_length()
        print(f"{label} ({normalized}, active={active}, {length} characters)")
# File: cli.py
from src.status_reporter import StatusReporter

if __name__ == "__main__":
    reporter = StatusReporter("ready")
    reporter.report()
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
    def summary(self) -> str:
        labels = [
            self.label("ready"),
            self.label_with_prefix("State", "blocked"),
            self.uppercase_fallback(),
            str(self.status_count()),
        ]
        return " | ".join(labels)
    def report(self) -> None:
        """Responsibilities: _status report output_."""
        print(self.summary())
# File: cli.py
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    status_labels.report()
```
