# `method-create-build-generate-name`

Description: Review public non-boolean result methods beginning with `create*`, `build*`,
or `generate*`. Prefer the returned value: `createUser()` → `user()` and
`generateToken()` → `token()`.

Allow the exact `build()` operation on a `*Registry` class: it names producing
the source-specific registry result. Compound names such as `build_report()` are
still reported.

This does not prohibit concrete commands. A method that changes the outside
world should use a verb and normally return `void`/`None`, such as
`register(user)` or `publish(article)`.

## Bad


```python
# File: src/price_labels/price_labels.py
class PriceLabels:
    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        self._labels: dict[str, str] = labels
        self._fallback: str = fallback

    def label(self, status: str) -> str:
        if status in self._labels:
            return self._labels[status]
        return self._fallback

    def status_count(self) -> int:
        count = 0
        for status_name in self._labels:
            if status_name:
                count += 1
        return count

    def create_receipt(self, status: str) -> str:
        label = self.label(status)
        count = self.status_count()
        return f"{status}: {label} ({count} labels)"

    def report(self) -> None:
        receipt = self.create_receipt("ready")
        print(receipt)
# File: cli.py
from src.price_labels.price_labels import PriceLabels

if __name__ == "__main__":
    price_labels = PriceLabels({"ready": "Ready"}, "Unknown")
    price_labels.report()
```

## Good


```python
# File: src/price_labels/price_labels.py
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
        """Responsibilities: _receipt summary reporting_."""
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        fallback = self.uppercase_fallback()
        count = self.status_count()
        print(f"{label} {detailed} {fallback} {count}")
# File: cli.py
from src.price_labels.price_labels import PriceLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    price_labels = PriceLabels(labels, "Unknown")
    price_labels.report()
```
