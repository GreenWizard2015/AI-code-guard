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
# File: src/price_labels/price_labels.py
class PriceLabels:
    def __init__(self, prices: dict[str, str], fallback: str) -> None:
        self._prices: dict[str, str] = prices
        self._fallback: str = fallback

    def set_price(self, price_code: str, label: str) -> None:
        normalized_code = price_code.strip().lower()
        self._prices[normalized_code] = label.strip()

    def price_label(self, price_code: str) -> str:
        normalized_code = price_code.strip().lower()
        if normalized_code in self._prices:
            return self._prices[normalized_code]
        return self._fallback

    def price_count(self) -> int:
        count = 0
        for code in self._prices:
            if code:
                count += 1
        return count

    def report(self) -> None:
        self.set_price("discount", "Discount")
        label = self.price_label("discount")
        count = self.price_count()
        print(f"{label} ({count} prices)")
# File: cli.py
from src.price_labels.price_labels import PriceLabels

if __name__ == "__main__":
    labels = PriceLabels({"sale": "Sale"}, "Unknown")
    labels.report()
```

## Good


```python
# File: src/price_labels/price_labels.py

class PriceLabels:
    """Responsibilities: _price label mapping_."""

    def __init__(self, prices: dict[str, str], fallback: str) -> None:
        """Responsibilities: _mapping initialization_."""
        self._prices: dict[str, str] = prices
        self._fallback: str = fallback

    def record_price(self, price_code: str, label: str) -> int:
        normalized_code = price_code.strip().lower()
        normalized_label = label.strip()
        self._prices[normalized_code] = normalized_label
        return len(self._prices)

    def price_label(self, price_code: str) -> str:
        """Responsibilities: _price label selection_."""
        normalized_code = price_code.strip().lower()
        if normalized_code in self._prices:
            return self._prices[normalized_code]
        return self._fallback

    def prefixed_price_label(self, prefix: str, code: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        label = self.price_label(code)
        return f"{prefix}: {label}"

    def report(self) -> None:
        """Responsibilities: _price overview reporting_."""
        recorded_count = self.record_price("discount", "Discount")
        label = self.price_label("sale")
        detailed = self.prefixed_price_label("State", "tax")
        print(f"{label} {detailed} {recorded_count}")

# File: cli.py
from src.price_labels.price_labels import PriceLabels

if __name__ == "__main__":
    prices = {"sale": "Sale", "tax": "Tax"}
    price_labels = PriceLabels(prices, "Unknown")
    price_labels.report()
```
