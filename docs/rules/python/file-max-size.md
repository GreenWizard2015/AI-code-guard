# `file-max-size`

Description: Detect source files that exceed the maintainable line count. Blank lines and comments count. Split only at real ownership boundaries.

## Bad

One growing module mixes row parsing, selection, and invoice calculations; repeated comments represent its accumulated code:

```python
# File: src/orders.py
class Orders:
    def __init__(self, text: str) -> None:
        self._text: str = text
    def rows(self) -> list[str]:
        return [row.strip() for row in self._text.splitlines() if row.strip()]
    def paid_rows(self) -> list[str]:
        return [row for row in self.rows() if row.endswith(",paid")]
    def invoice_total(self) -> float:
        total = 0.0
        for row in self.rows():
            fields = row.split(",")
            total += float(fields[1])
        return total
{% for index in range(600) %}
    # More accumulated parsing, selection, and invoice behavior.
{% endfor %}
# File: cli.py
from src.orders import Orders
if __name__ == "__main__":
    orders = Orders("ORD-42,18.50,paid")
    rows = orders.rows()
    paid_rows = orders.paid_rows()
    total = orders.invoice_total()
    print(rows, paid_rows, total)
```

## Good

Separate row ownership and invoice calculations:

```python
# File: src/order_ledger.py
class OrderLedger:
    def __init__(self, text: str) -> None:
        self._text: str = text
    def rows(self) -> list[str]:
        return [row.strip() for row in self._text.splitlines() if row.strip()]
    def count(self) -> int:
        return sum(1 for row in self._text.splitlines() if row.strip())
    def paid_rows(self) -> list[str]:
        return [row for row in self.rows() if row.endswith(",paid")]
    def paid_count(self) -> int:
        return sum(1 for row in self.rows() if row.endswith(",paid"))
    def contains_order(self, order_id: str) -> bool:
        for row in self.rows():
            fields = row.split(",")
            if fields[0] == order_id:
                return True
        return False
# File: src/order_invoice.py
class OrderInvoice:
    def __init__(self, rows: list[str]) -> None:
        self._rows: list[str] = rows
    def total(self) -> float:
        amounts: list[float] = []
        for row in self._rows:
            fields = row.split(",")
            amounts.append(float(fields[1]))
        return sum(amounts)
    def count(self) -> int:
        return sum(1 for row in self._rows if row)
    def average(self) -> float:
        count = self.count()
        if count == 0:
            return 0.0
        return self.total() / count
# File: cli.py
from src.order_invoice import OrderInvoice
from src.order_ledger import OrderLedger
if __name__ == "__main__":
    ledger = OrderLedger("ORD-42,18.50,paid")
    rows = ledger.rows()
    row_count = ledger.count()
    paid_rows = ledger.paid_rows()
    paid_count = ledger.paid_count()
    contains_order = ledger.contains_order("ORD-42")
    invoice = OrderInvoice(rows)
    total = invoice.total()
    count = invoice.count()
    average = invoice.average()
    print(rows, row_count, paid_rows, paid_count, contains_order, total, count, average)
```
