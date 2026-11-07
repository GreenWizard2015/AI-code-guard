# `file-min-size`

Description: Detect a source file with very little implementation code. A tiny forwarding module can indicate misplaced behavior; this size check does not decide whether a small domain type is meaningful.

Pytest `conftest.py` files are exempt: even a one-line plugin declaration can be a required framework entrypoint. Do not pad them with unrelated code.

## Bad

This module only forwards behavior already owned by `Order`:

```python
# File: src/order_label.py
from src.order import Order
class OrderLabel:
    def format(self, order: Order) -> str:
        return order.display_label()
    def report(self, order: Order) -> None:
        label = self.format(order)
        paid = order.paid()
        order.add_item("book")
        item_summary = order.item_summary()
        print(f"{label} paid={paid} items={item_summary}")
# File: src/order.py
class Order:
    def __init__(self, code: str, status: str) -> None:
        normalized_code = code.strip().upper()
        if not normalized_code:
            raise ValueError("Order code is required.")
        self._code: str = normalized_code
        if not status:
            raise ValueError("Order status is required.")
        self._status: str = status
        self._items: list[str] = []
    def display_label(self) -> str:
        return f"Order {self._code}"
    def paid(self) -> bool:
        return self._status == "paid"
    def add_item(self, item: str) -> None:
        normalized = item.strip()
        if normalized:
            self._items.append(normalized)
    def item_summary(self) -> str:
        return ", ".join(self._items)
# File: cli.py
from src.order import Order
from src.order_label import OrderLabel
if __name__ == "__main__":
    order = Order("ord-42", "paid")
    OrderLabel().report(order)
```

## Good

Use the existing owner directly and remove the forwarding module:

```python
# File: src/order.py
class Order:
    def __init__(self, code: str, status: str, items: list[str]) -> None:
        normalized_code = code.strip().upper()
        if not normalized_code:
            raise ValueError("Order code is required.")
        self._code: str = normalized_code
        if not status:
            raise ValueError("Order status is required.")
        self._status: str = status
        self._items: list[str] = items
    def display_label(self) -> str:
        return f"Order {self._code}"
    def paid(self) -> bool:
        return self._status == "paid"
    def item_summary(self) -> str:
        return ", ".join(self._items)
    def report(self) -> None:
        label = self.display_label()
        paid = self.paid()
        items = self.item_summary()
        print(f"{label} paid={paid} items={items}")
# File: cli.py
from src.order import Order
if __name__ == "__main__":
    order = Order("ord-42", "paid", ["book"])
    order.report()
```
