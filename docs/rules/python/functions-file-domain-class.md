# `functions-file-domain-class`

Description: The exact root `functions.ts`, `functions.tsx`, or `functions.py` file must not contain free functions. Move each function and its state into a focused domain class in a focused module, then remove the root file when it is empty. Nested functions and class methods are not reported by this rule.

Problem: `functions.*` contains a free function.

Hint: Move the function and its state into a focused domain class in a focused module, then remove the root `functions.*` file when it is empty. Do not hide it behind a forwarding wrapper.

## Bad


```python
# File: functions.py
def resolve_user(user_id: str) -> str:
    return user_id.strip()

def report_user(user_id: str) -> None:
    print(f"User: {resolve_user(user_id)}")

def format_invoice(invoice_id: str) -> str:
    return f"Invoice {invoice_id.strip()}"

def report_invoice(invoice_id: str) -> None:
    print(format_invoice(invoice_id))
# File: cli.py
from functions import report_invoice, report_user

if __name__ == "__main__":
    report_user("user-7")
    report_invoice("invoice-3")
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
    def report(self) -> None:
        """Responsibilities: _status summary reporting_."""
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        fallback = self.uppercase_fallback()
        count = self.status_count()
        print(f"{label} {detailed} {fallback} {count}")
# File: cli.py
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    status_labels.report()
```
