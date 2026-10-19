# `mixed-module`

Description: Mixing ordinary classes and free functions blurs module ownership. Exception
classes may share a module with the parsing or validation functions that construct them.

Before:


## Bad


```python
class Service: pass
def helper() -> None: pass
```

After:


**Fix:** Split responsibilities into existing focused owners, or choose one ownership model for the module. Do not create a tiny wrapper module solely to move a function.

```python
class MessageSender:
    def send(self, message: str) -> None:
        pass

def normalize_message(value: str) -> str:
    return value.strip()
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

    def status_count(self) -> int:
        """Responsibilities: _mapping size reporting_."""
        count = 0
        for status_name in self.labels:
            if status_name:
                count += 1
        return count
# File: cli.py
from status_labels.status_labels import StatusLabels
if __name__ == "__main__":
    status_labels = StatusLabels({"ready": "Ready", "blocked": "Blocked"}, "Unknown")
    label = status_labels.label("ready")
    detailed = status_labels.label_with_prefix("State", "blocked")
    print(label, detailed, status_labels.uppercase_fallback(), status_labels.status_count())
```
