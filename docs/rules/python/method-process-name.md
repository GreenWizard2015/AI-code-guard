# `method-process-name`

Description: Review public commands beginning with `process*`. The name often hides several
actions: `processPayment()` may validate, authorize, charge, store, and notify.
Replace it with the concrete domain action or split the responsibilities.
`process` may remain at a genuine generic processing boundary.

## Bad


```python
# File: src/payment.py
class Payment:
    def __init__(self, account_id: str, amount: float) -> None:
        self._account_id: str = account_id
        self._amount: float = amount

    def _approval_status(self) -> str:
        if self._amount > 0:
            return "approved"
        return "review"

    def _charge_line(self) -> str:
        return f"{self._account_id}: {self._amount:.2f}"

    def process_payment(self) -> str:  # <- error
        approval = self._approval_status()
        charge = self._charge_line()
        return f"{approval}: {charge}"

    def report(self) -> None:
        receipt = self.process_payment()
        print(receipt)
# File: cli.py
from src.payment import Payment

if __name__ == "__main__":
    payment = Payment("account-1", 25.5)
    payment.report()
```

## Good


```python
# File: src/payment.py
class Payment:
    """Responsibilities: _payment authorization_, _account charging_, _receipt reporting_."""

    def __init__(self, account_id: str, amount: float) -> None:
        """Responsibilities: _payment initialization_."""
        self._account_id: str = account_id
        self._amount: float = amount

    def approval_status(self) -> str:
        """Responsibilities: _payment approval status_."""
        if self._amount > 0:
            return "approved"
        return "review"

    def charge_account(self) -> str:
        """Responsibilities: _account charge description_."""
        account = self._account_id.strip()
        amount = f"{self._amount:.2f}"
        return f"{account}: {amount}"

    def receipt(self) -> str:
        """Responsibilities: _payment receipt_."""
        approval = self.approval_status()
        charge = self.charge_account()
        return f"{approval}: {charge}"

    def report(self) -> None:
        """Responsibilities: _receipt output_."""
        receipt = self.receipt()
        print(receipt)
# File: cli.py
from src.payment import Payment

if __name__ == "__main__":
    payment = Payment("account-1", 25.5)
    payment.report()
```
