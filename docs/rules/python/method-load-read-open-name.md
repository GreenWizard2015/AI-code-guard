# `method-load-read-open-name`

Description: Review public non-boolean result methods beginning with `load*`, `read*`, or
`open*`. Prefer the returned value or representation: `content()` may read a
file, use a cache, call HTTP, or return an existing object without exposing
that implementation choice.

## Bad


```python
class PriceLabels:
    def load_content(self) -> str:
        return 10
```

## Good


```python
# File: src/price_labels/price_labels.py
class PriceLabels:
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
from price_labels.price_labels import PriceLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    price_labels = PriceLabels(labels, "Unknown")
    label = price_labels.label("ready")
    detailed = price_labels.label_with_prefix("State", "blocked")
    fallback = price_labels.uppercase_fallback()
    count = price_labels.status_count()
    print(f"{label} {detailed} {fallback} {count}")
```
