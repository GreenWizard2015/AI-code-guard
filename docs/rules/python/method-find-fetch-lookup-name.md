# `method-find-fetch-lookup-name`

Description: Review public non-boolean result methods beginning with `find*`, `fetch*`, or
`lookup*`. These names expose how a result is obtained rather than the result
itself. Prefer `book(title)` over `find(title)`: the implementation remains
free to use a cache, construct the value, or retrieve it remotely.

## Bad

```python
# File: src/receipt_book.py
class ReceiptBook:
    def __init__(self, receipt_id: str, item_count: int, amount: float) -> None:
        self._receipt_id: str = receipt_id
        self._item_count: int = item_count
        self._amount: float = amount

    def find_receipt(self) -> str:  # <- error
        return f"{self._receipt_id}: {self._amount}"

    def item_summary(self) -> str:
        return f"{self._item_count} items"

    def total_label(self) -> str:
        return f"Total {self._amount:.2f}"

    def summary(self) -> str:
        receipt = self.find_receipt()
        items = self.item_summary()
        return f"{receipt} | {items} | {self.total_label()}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.receipt_book import ReceiptBook

if __name__ == "__main__":
    receipt = ReceiptBook("R-17", 3, 24.5)
    receipt.report()
```

## Good

```python
# File: src/receipt_book.py
class ReceiptBook:
    def __init__(self, receipt_id: str, item_count: int, amount: float) -> None:
        self._receipt_id: str = receipt_id
        self._item_count: int = item_count
        self._amount: float = amount

    def receipt(self) -> str:
        return f"{self._receipt_id}: {self._amount}"

    def item_summary(self) -> str:
        return f"{self._item_count} items"

    def total_label(self) -> str:
        return f"Total {self._amount:.2f}"

    def summary(self) -> str:
        receipt = self.receipt()
        items = self.item_summary()
        return f"{receipt} | {items} | {self.total_label()}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.receipt_book import ReceiptBook

if __name__ == "__main__":
    receipt = ReceiptBook("R-17", 3, 24.5)
    receipt.report()
```
