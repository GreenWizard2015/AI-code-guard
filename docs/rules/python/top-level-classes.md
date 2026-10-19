# `top-level-classes`

Description: One primary top-level class gives a file a clear owner.

## Bad


```python
class AccountRecord:
    def account_id(self) -> str: return "a"
class AddressRecord:
    def postal_code(self) -> int: return 1
class AuditRecord:
    def event_name(self) -> bool: return True
class SessionRecord:  # <- error
    def expires_at(self) -> float: return 1.0
```

**Fix:** Move independent classes to focused files; keep one small exception hierarchy together when appropriate.

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
