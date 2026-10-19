# `method-process-name`

Description: Review public commands beginning with `process*`. The name often hides several
actions: `processPayment()` may validate, authorize, charge, store, and notify.
Replace it with the concrete domain action or split the responsibilities.
`process` may remain at a genuine generic processing boundary.

## Bad


```python
class PriceLabels:
    def process_payment(self) -> str:
        return 10
```

## Good


```python
# File: src/price_labels/price_labels.py
class PriceLabels:
    """Responsibilities: _price label mapping_."""

    def __init__(self, prices: dict[str, str], fallback: str) -> None:
        """Responsibilities: _mapping initialization_."""
        self.prices: dict[str, str] = prices
        self.fallback: str = fallback

    def price_label(self, price_code: str) -> str:
        """Responsibilities: _price label selection_."""
        if price_code in self.prices:
            return self.prices[price_code]
        return self.fallback

    def prefixed_price_label(self, prefix: str, price_code: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        label = self.price_label(price_code)
        return f"{prefix}: {label}"

    def formatted_fallback(self) -> str:
        """Responsibilities: _fallback capitalization_."""
        normalized = self.fallback.strip()
        return normalized.upper()

    def price_count(self) -> int:
        """Responsibilities: _mapping size reporting_."""
        count = 0
        for price_code in self.prices:
            if price_code:
                count += 1
        return count
# File: cli.py
from price_labels.price_labels import PriceLabels

if __name__ == "__main__":
    prices = {"sale": "Sale", "tax": "Tax"}
    price_labels = PriceLabels(prices, "Unknown")
    label = price_labels.price_label("sale")
    detailed = price_labels.prefixed_price_label("State", "tax")
    fallback = price_labels.formatted_fallback()
    count = price_labels.price_count()
    print(f"{label} {detailed} {fallback} {count}")
```
