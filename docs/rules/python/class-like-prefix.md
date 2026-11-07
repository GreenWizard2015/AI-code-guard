# `class-like-prefix`

Description: Many top-level functions with one class-style prefix often indicate a missing owner.


## Bad


```python
# File: src/user_actions.py
def _User_load() -> str:
    print("Ada")
    return "Ada"

def _User_save() -> str:
    print("saved")
    return "saved"

# File: cli.py
if __name__ == "__main__":
    from src.user_actions import _User_load, _User_save
    _User_load()
    _User_save()
```

**Fix:** Group cohesive behavior in a focused class or module.

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
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        fallback = self.uppercase_fallback()
        count = self.status_count()
        print(label, detailed, fallback, count)
# File: cli.py
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    status_labels.report()
```
