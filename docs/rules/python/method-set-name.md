# `method-set-name`

Description: See the examples below for the rule behavior.

### `set*`

`set` usually exposes a mutable data holder: callers learn the object's fields
and directly control its state.

```java
setName(...)
setStatus(...)
setPrice(...)
setOwner(...)
```

Prefer a domain command when the change is a real business action:

```java
setStatus(APPROVED)  →  approve()
setOwner(user)       →  assign(user)
```

If the changed value is part of the object's identity, prefer a new immutable
object instead of mutating the existing one. The rule is a design prompt, not
a ban on every setter: a technical adapter or genuine configuration property
may need `set_timeout`.

## Bad


```python
class PriceLabels:
    def set_price(self, price: int) -> None:
        return
```

## Good


```python
# File: src/price_labels/price_labels.py
from __future__ import annotations

class PriceLabels:
    """Responsibilities: _price label mapping_."""

    def __init__(self, prices: dict[str, str], fallback: str) -> None:
        """Responsibilities: _mapping initialization_."""
        self.prices: dict[str, str] = prices
        self.fallback: str = fallback

    def record_price(self, price_code: str, label: str) -> int:
        normalized_code = price_code.strip().lower()
        normalized_label = label.strip()
        self.prices[normalized_code] = normalized_label
        return len(self.prices)

    def price_label(self, price_code: str) -> str:
        """Responsibilities: _price label selection_."""
        normalized_code = price_code.strip().lower()
        if normalized_code in self.prices:
            return self.prices[normalized_code]
        return self.fallback

    def prefixed_price_label(self, prefix: str, price_code: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        label = self.price_label(price_code)
        return f"{prefix}: {label}"
# File: cli.py
from price_labels.price_labels import PriceLabels

if __name__ == "__main__":
    prices = {"sale": "Sale", "tax": "Tax"}
    price_labels = PriceLabels(prices, "Unknown")
    recorded_count = price_labels.record_price("discount", "Discount")
    label = price_labels.price_label("sale")
    detailed = price_labels.prefixed_price_label("State", "tax")
    print(f"{label} {detailed} {recorded_count}")
```
