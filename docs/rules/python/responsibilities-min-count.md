# responsibilities-min-count

Description: Detect a class whose `Responsibilities:` line names fewer than two distinct areas of work. Interfaces, protocols, and field-only record classes may have one cohesive contract responsibility; functions and methods need one.

Expand a class contract when it owns another real area of work, or split it when the work does not belong together. A class containing only annotated fields is a record contract and needs one responsibility. Do not repeat vague words or add padding only to silence the rule.

## Bad


```python
# File: src/account_session.py
class AccountSession:
    """Responsibilities: _account state_."""
    def __init__(self, account_id: str) -> None:
        self.account_id: str = account_id
    def account(self) -> str:
        """Responsibilities: _account lookup_."""
        return self.account_id
    def label(self) -> str:
        """Responsibilities: _account label_."""
        return f"Account {self.account_id}"
    def report(self) -> None:
        """Responsibilities: _account session report_."""
        print(f"{self.account()} | {self.label()}")
# File: cli.py
from src.account_session import AccountSession
if __name__ == "__main__":
    account = AccountSession("account-1")
    account.report()
```

## Good


```python
# File: src/protocols.py
from typing import Protocol
class UserSessionContract(Protocol):
    """Responsibilities: _session contract_, _lifecycle boundary_."""
    def refresh(self) -> str: ...
    def close(self) -> str: ...
    def status_label(self) -> str: ...
# File: src/user_session.py
from src.protocols import UserSessionContract
class UserSession(UserSessionContract):
    """Responsibilities: _account identity_, _session state_."""
    def __init__(self, account_id: str) -> None:
        """Responsibilities: _session initialization_."""
        self._account_id: str = account_id
    def refresh(self) -> str:
        """Responsibilities: _account validation_."""
        account = self._account_id.strip()
        if len(account) == 0: return "invalid"
        return "refreshed"
    def close(self) -> str:
        """Responsibilities: _session closure_."""
        return f"closed {self._account_id.strip()}"
    def status_label(self) -> str:
        """Responsibilities: _session status_."""
        account = self._account_id.strip()
        if len(account) == 0: return "unavailable"
        return f"Account {account}"
    def report(self) -> None:
        """Responsibilities: _session report output_."""
        print(f"{self.refresh()} | {self.close()} | {self.status_label()}")
# File: cli.py
from src.user_session import UserSession

if __name__ == "__main__":
    session = UserSession("account-1")
    session.report()
```
