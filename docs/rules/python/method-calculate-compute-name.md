# `method-calculate-compute-name`

Description: Review public non-boolean result methods beginning with `calculate*` or
`compute*`. Name the result rather than the procedure: `calculatePrice()` →
`price()`, `computeHash()` → `hash()`, and `computeDistance()` → `distance()`.

## Bad

```python
# File: src/invoice_total.py
class InvoiceTotal:
    def __init__(self, unit_price: float, quantity: int, tax_rate: float) -> None:
        self._unit_price: float = unit_price
        self._quantity: int = quantity
        self._tax_rate: float = tax_rate

    def subtotal(self) -> float:
        return self._unit_price * self._quantity

    def tax_amount(self) -> float:
        return self.subtotal() * self._tax_rate

    def calculate_total(self) -> float:  # <- error
        base_amount = self.subtotal()
        tax_amount = self.tax_amount()
        return base_amount + tax_amount

    def summary(self) -> str:
        return f"Subtotal {self.subtotal():.2f}, total {self.calculate_total():.2f}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.invoice_total import InvoiceTotal

if __name__ == "__main__":
    invoice = InvoiceTotal(18.5, 2, 0.08)
    invoice.report()
```

## Good

```python
# File: src/invoice_total.py
class InvoiceTotal:
    def __init__(self, unit_price: float, quantity: int, tax_rate: float) -> None:
        self._unit_price: float = unit_price
        self._quantity: int = quantity
        self._tax_rate: float = tax_rate

    def subtotal(self) -> float:
        return self._unit_price * self._quantity

    def tax_amount(self) -> float:
        return self.subtotal() * self._tax_rate

    def total(self) -> float:
        base_amount = self.subtotal()
        tax_amount = self.tax_amount()
        return base_amount + tax_amount

    def summary(self) -> str:
        return f"Subtotal {self.subtotal():.2f}, total {self.total():.2f}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.invoice_total import InvoiceTotal

if __name__ == "__main__":
    invoice = InvoiceTotal(18.5, 2, 0.08)
    invoice.report()
```
