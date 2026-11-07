# `method-and-name`

Description: Review public method names containing `_and_` or `And`. They often combine two
responsibilities: `saveAndReturn()`, `validateAndSave()`, or `findAndDelete()`.
Split the contracts unless the combined operation must be atomic. Builders
should not have side effects; manipulators should normally return `void`/`None`.

## Bad


```python
# File: src/receipt_archive.py
class ReceiptArchive:
    def __init__(self, receipt_id: str) -> None:
        self._receipt_id: str = receipt_id

    def save_and_return(self) -> str:  # <- error
        return f"Saved receipt {self._receipt_id}"

    def report(self) -> None:
        result = self.save_and_return()
        print(result)
# File: cli.py
from src.receipt_archive import ReceiptArchive

if __name__ == "__main__":
    archive = ReceiptArchive("R-17")
    archive.report()
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
