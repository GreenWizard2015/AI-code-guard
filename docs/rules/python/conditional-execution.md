# `conditional-execution`

Description: Avoid hiding side effects inside `&&`, `||`, `??`, `and`, or `or`. Use an
explicit branch when a logical condition controls an operation. Pure boolean
expressions remain valid.

## Bad


```python
# File: src/delivery_reporter.py
class DeliveryReporter:
    """Responsibilities: _delivery status reporting_."""

    def __init__(self, ready: bool) -> None:
        """Responsibilities: _reporter initialization_."""
        self._ready: bool = ready

    def _load_value(self) -> str:
        """Responsibilities: _delivery value loading_."""
        return "Delivery ready"

    def resolve_value(self) -> str:
        """Responsibilities: _conditional value resolution_."""
        loaded_value = self._ready and self._load_value()
        return loaded_value or "Delivery unavailable"

    def status_label(self) -> str:
        """Responsibilities: _delivery status formatting_."""
        return f"Status: {self.resolve_value()}"

    def report(self) -> None:
        """Responsibilities: _delivery status output_."""
        print(self.status_label())
# File: cli.py
from src.delivery_reporter import DeliveryReporter

if __name__ == "__main__":
    reporter = DeliveryReporter(True)
    reporter.report()
```

## Good


```python
# File: src/delivery_reporter.py

class DeliveryReporter:
    """Responsibilities: _delivery status reporting_."""

    def __init__(self, value: str) -> None:
        """Responsibilities: _reporter initialization_."""
        self._value: str = value

    def resolve_value(self) -> str:
        """Responsibilities: _explicit value resolution_."""
        if self._value.strip():
            return self._value
        return "Delivery unavailable"

    def normalized_value(self) -> str:
        """Responsibilities: _delivery value normalization_."""
        resolved = self.resolve_value()
        trimmed = resolved.strip()
        return trimmed.lower()

    def status_label(self) -> str:
        """Responsibilities: _delivery status formatting_."""
        return f"Status: {self.normalized_value()}"

    def label_length(self) -> int:
        """Responsibilities: _report label measurement_."""
        label = self.status_label()
        return len(label)

    def report(self) -> None:
        """Responsibilities: _delivery status output_."""
        status = self.status_label()
        length = self.label_length()
        print(f"{status} ({length} characters)")
# File: cli.py
from src.delivery_reporter import DeliveryReporter

if __name__ == "__main__":
    reporter = DeliveryReporter("Delivery ready")
    reporter.report()
```
