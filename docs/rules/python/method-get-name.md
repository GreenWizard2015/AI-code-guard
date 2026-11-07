# `method-get-name`

Description: Review public non-boolean result methods beginning with `get*`. The name
usually exposes getter-style access to a mutable data holder. Prefer the
returned value: `getPrice()` → `price()` and `getUser(id)` → `user(id)`.

This is a review signal, not a ban at a technical adapter boundary.

## Bad

```python
# File: src/price_quote.py
class PriceQuote:
    def __init__(self, item_label: str, amount: float, tax_rate: float) -> None:
        self._item_label: str = item_label
        self._amount: float = amount
        self._tax_rate: float = tax_rate

    def get_price(self) -> float:  # <- error
        return self._amount

    def price_with_tax(self) -> float:
        tax_amount = self._amount * self._tax_rate
        return self._amount + tax_amount

    def summary(self) -> str:
        base_price = self.get_price()
        taxed_price = self.price_with_tax()
        return f"{self._item_label}: {base_price} / {taxed_price}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.price_quote import PriceQuote

if __name__ == "__main__":
    quote = PriceQuote("Notebook", 12.0, 0.08)
    quote.report()
```

## Good

```python
# File: src/price_quote.py
class PriceQuote:
    def __init__(self, item_label: str, amount: float, tax_rate: float) -> None:
        self._item_label: str = item_label
        self._amount: float = amount
        self._tax_rate: float = tax_rate

    def price(self) -> float:
        return self._amount

    def price_with_tax(self) -> float:
        tax_amount = self._amount * self._tax_rate
        return self._amount + tax_amount

    def summary(self) -> str:
        base_price = self.price()
        taxed_price = self.price_with_tax()
        return f"{self._item_label}: {base_price} / {taxed_price}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.price_quote import PriceQuote

if __name__ == "__main__":
    quote = PriceQuote("Notebook", 12.0, 0.08)
    quote.report()
```
