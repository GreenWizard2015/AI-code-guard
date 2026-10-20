# `file-min-size`

Description: Detect a source file with very little implementation code. A tiny forwarding module can indicate misplaced behavior; this size check does not decide whether a small domain type is meaningful.

## Bad

This module only forwards behavior already owned by `Order`:

```python
# File: order_label.py
from order import Order
class OrderLabel:
    def format(self, order: Order) -> str:
        return order.display_label()
# File: order.py
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
from order import Order
from order_label import OrderLabel
if __name__ == "__main__":
    order = Order("ord-42", "paid")
    label = OrderLabel().format(order)
    paid = order.paid()
    order.add_item("book")
    item_summary = order.item_summary()
    print([label, paid, item_summary])
```

## Good

Use the existing owner directly and remove the forwarding module:

```python
# File: order.py
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
from order import Order
if __name__ == "__main__":
    order = Order("ord-42", "paid")
    label = order.display_label()
    paid = order.paid()
    order.add_item("book")
    item_summary = order.item_summary()
    print([label, paid, item_summary])
```
