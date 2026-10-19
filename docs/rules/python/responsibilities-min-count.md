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
# File: cli.py
from src.account_session import AccountSession
if __name__ == "__main__":
    account = AccountSession("account-1")
    print(account.account(), account.label())
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
#!/usr/bin/env python3
from logging import Logger, getLogger
from src.protocols import UserSessionContract
class UserSession(UserSessionContract):
    """Responsibilities: _account identity_, _session state_."""
    def __init__(self, logger: Logger, account_id: str) -> None:
        """Responsibilities: _session initialization_."""
        self.logger: Logger = logger
        self.account_id: str = account_id
    def refresh(self) -> str:
        """Responsibilities: _account validation_."""
        account = self.account_id.strip()
        if len(account) == 0: return "invalid"
        self.logger.info(f"refresh {account}")
        return "refreshed"
    def close(self) -> str:
        """Responsibilities: _session closure_."""
        self.logger.info(f"close {self.account_id}")
        return "closed"
    def status_label(self) -> str:
        """Responsibilities: _session status_."""
        account = self.account_id.strip()
        if len(account) == 0: return "unavailable"
        return f"Account {account}"
if __name__ == "__main__":
    session = UserSession(getLogger("sessions"), "account-1")
    print(session.refresh(), session.close(), session.status_label())
```
