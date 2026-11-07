# `method-execute-perform-do-name`

Description: Review public commands beginning with `execute*`, `perform*`, or `do*`. These
technical verbs carry little domain meaning. Replace `performValidation()` or
`doUpdate()` with the concrete domain action. Generic command infrastructure
may keep the technical name when it is the actual contract.

## Bad


```python
# File: src/payment_processor.py
class PaymentProcessor:
    def __init__(self, payment_reference: str) -> None:
        self._payment_reference: str = payment_reference

    def execute_payment(self) -> str:  # <- error
        return f"Payment {self._payment_reference} accepted"

    def report(self) -> None:
        result = self.execute_payment()
        print(result)
# File: cli.py
from src.payment_processor import PaymentProcessor

if __name__ == "__main__":
    processor = PaymentProcessor("PAY-42")
    processor.report()
```

## Good


```python
# File: src/price_labels.py
class PriceLabels:
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
        print(f"{label} {detailed} {fallback} {count}")
# File: cli.py
from src.price_labels import PriceLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    price_labels = PriceLabels(labels, "Unknown")
    price_labels.report()
```
