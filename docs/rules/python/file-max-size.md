# `file-max-size`

Description: Detect a source file whose raw line count has grown beyond a maintainable size. Comments and blank lines count. The diagnostic measures physical file size, not responsibility; split only along real ownership boundaries.

## Bad

One accumulated file owns source parsing, order selection, and invoice calculations (representative excerpt):

```python
# File: order_workflow.py
class OrderWorkflow:
    def __init__(self, text: str) -> None:
        self._text: str = text
    def rows(self) -> list[str]:
        rows: list[str] = []
        for row in self._text.splitlines():
            if row.strip():
                rows.append(row.strip())
        return rows
    def row_count(self) -> int:
        count = 0
        for row in self._text.splitlines():
            if row.strip():
                count += 1
        return count
    def empty(self) -> bool: return len(self._text.strip()) == 0
    def paid_rows(self) -> list[str]: return [row for row in self.rows() if row.endswith(",paid")]
    def unpaid_rows(self) -> list[str]: return [row for row in self.rows() if not row.endswith(",paid")]
    def paid_count(self) -> int:
        count = 0
        for row in self.rows():
            if row.endswith(",paid"):
                count += 1
        return count
    def contains_order(self, order_id: str) -> bool:
        for row in self.rows():
            fields = row.split(",")
            if fields[0] == order_id:
                return True
        return False
    def invoice_total(self) -> float:
        total = 0.0
        for row in self.rows():
            fields = row.split(",")
            total += float(fields[1])
        return total
    def invoice_count(self) -> int: return self.row_count()
    def average_invoice(self) -> float:
        count = self.invoice_count()
        if count == 0:
            return 0.0
        return self.invoice_total() / count
# File: cli.py
from order_workflow import OrderWorkflow
if __name__ == "__main__":
    workflow = OrderWorkflow("ORD-42,18.50,paid")
    rows = workflow.rows()
    row_count = workflow.row_count()
    empty = workflow.empty()
    paid = workflow.paid_rows()
    unpaid = workflow.unpaid_rows()
    paid_count = workflow.paid_count()
    contains_order = workflow.contains_order("ORD-42")
    total = workflow.invoice_total()
    invoice_count = workflow.invoice_count()
    average = workflow.average_invoice()
    print([rows, row_count, empty, paid, unpaid, paid_count, contains_order, total, invoice_count, average])
```

## Good

Keep the same behavior, with state and operations owned by focused modules:

```python
# File: order_source.py
class OrderSource:
    def __init__(self, text: str) -> None:
        self._text: str = text
    def rows(self) -> list[str]:
        rows: list[str] = []
        for row in self._text.splitlines():
            if row.strip():
                rows.append(row.strip())
        return rows
    def row_count(self) -> int:
        count = 0
        for row in self._text.splitlines():
            if row.strip():
                count += 1
        return count
    def empty(self) -> bool: return len(self._text.strip()) == 0
# File: paid_order_selection.py
class PaidOrderSelection:
    def __init__(self, rows: list[str]) -> None:
        self._rows: list[str] = rows
    def paid_rows(self) -> list[str]: return [row for row in self._rows if row.endswith(",paid")]
    def unpaid_rows(self) -> list[str]: return [row for row in self._rows if not row.endswith(",paid")]
    def paid_count(self) -> int:
        count = 0
        for row in self._rows:
            if row.endswith(",paid"):
                count += 1
        return count
    def contains_order(self, order_id: str) -> bool:
        for row in self._rows:
            fields = row.split(",")
            if fields[0] == order_id:
                return True
        return False
# File: order_invoice.py
class OrderInvoice:
    def __init__(self, rows: list[str]) -> None:
        self._rows: list[str] = rows
    def invoice_total(self) -> float:
        total = 0.0
        for row in self._rows:
            fields = row.split(",")
            total += float(fields[1])
        return total
    def invoice_count(self) -> int:
        count = 0
        for row in self._rows:
            if row:
                count += 1
        return count
    def average_invoice(self) -> float:
        count = self.invoice_count()
        if count == 0:
            return 0.0
        return self.invoice_total() / count
# File: cli.py
from order_invoice import OrderInvoice
from order_source import OrderSource
from paid_order_selection import PaidOrderSelection
if __name__ == "__main__":
    source = OrderSource("ORD-42,18.50,paid")
    rows = source.rows()
    row_count = source.row_count()
    empty = source.empty()
    selection = PaidOrderSelection(rows)
    paid = selection.paid_rows()
    unpaid = selection.unpaid_rows()
    paid_count = selection.paid_count()
    contains_order = selection.contains_order("ORD-42")
    invoice = OrderInvoice(rows)
    total = invoice.invoice_total()
    invoice_count = invoice.invoice_count()
    average = invoice.average_invoice()
    print([rows, row_count, empty, paid, unpaid, paid_count, contains_order, total, invoice_count, average])
```
