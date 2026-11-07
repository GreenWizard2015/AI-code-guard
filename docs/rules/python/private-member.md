# `private-member`

Description: Access private state through a public operation on its owning class.

## Bad

```python
# File: src/account_statement.py
class AccountStatement:
    def __init__(self, account_name: str, entries: list[str], period: str) -> None:
        self._account_name: str = account_name
        self._entries: list[str] = entries
        self._period: str = period
    def render(self) -> str:
        details = "\n".join(f"- {entry}" for entry in self._entries)
        if len(details) == 0:
            return f"{self._account_name} {self._period}: no entries"
        return f"{self._account_name} {self._period}\n{details}"
    def entry_count(self) -> int:
        return len(self._entries)
    def subtitle(self) -> str:
        return f"{self.entry_count()} entries"
    def report(self) -> None:
        print(f"{self.render()}\n{self.subtitle()}")
# File: cli.py
from src.account_statement import AccountStatement

class Cli:
    def __init__(self, balance: int, currency: str) -> None:
        self._account_balance: int = balance
        self._currency: str = currency
        self._invalid_amount: str = "invalid amount"
    def formatted_balance(self) -> str:
        return f"{self._currency} {self._account_balance}"
    def withdrawal_text(self, amount: int) -> str:
        if amount < 0:
            return self._invalid_amount
        if amount > self._account_balance:
            return "insufficient funds"
        return f"{self._currency} {self._account_balance - amount}"
    def deposit_text(self, deposit_amount: int) -> str:
        if deposit_amount <= 0:
            return self._invalid_amount
        updated_balance = self._account_balance + deposit_amount
        return f"{self._currency} {updated_balance}"
    def report_balance(self) -> None:
        statement = AccountStatement("Account", [self.formatted_balance()], "today")
        statement.report()

if __name__ == "__main__":
    cli = Cli(20, "USD")
    exposed_balance = cli._account_balance
    cli.withdrawal_text(exposed_balance)
    cli.deposit_text(5)
    cli.report_balance()
```

## Good

```python
# File: src/account_statement.py
class AccountStatement:
    def __init__(self, account_name: str, entries: list[str], period: str) -> None:
        self._account_name: str = account_name
        self._entries: list[str] = entries
        self._period: str = period
    def render(self) -> str:
        details = "\n".join(f"- {entry}" for entry in self._entries)
        if len(details) == 0:
            return f"{self._account_name} {self._period}: no entries"
        return f"{self._account_name} {self._period}\n{details}"
    def entry_count(self) -> int:
        return len(self._entries)
    def subtitle(self) -> str:
        return f"{self.entry_count()} entries"
    def report(self) -> None:
        print(f"{self.render()}\n{self.subtitle()}")
# File: cli.py
from src.account_statement import AccountStatement

class Cli:
    def __init__(self, balance: int, currency: str) -> None:
        self._account_balance: int = balance
        self._currency: str = currency
        self._invalid_amount: str = "invalid amount"
    def formatted_balance(self) -> str:
        return f"{self._currency} {self._account_balance}"
    def withdrawal_text(self, amount: int) -> str:
        if amount < 0:
            return self._invalid_amount
        if amount > self._account_balance:
            return "insufficient funds"
        return f"{self._currency} {self._account_balance - amount}"
    def deposit_text(self, deposit_amount: int) -> str:
        if deposit_amount <= 0:
            return self._invalid_amount
        updated_balance = self._account_balance + deposit_amount
        return f"{self._currency} {updated_balance}"
    def report_balance(self) -> None:
        statement = AccountStatement("Account", [self.formatted_balance()], "today")
        statement.report()

if __name__ == "__main__":
    cli = Cli(20, "USD")
    cli.withdrawal_text(5)
    cli.deposit_text(5)
    cli.report_balance()
```
