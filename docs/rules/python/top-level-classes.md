# `top-level-classes`

Description: One primary top-level class gives a file a clear owner.

## Bad


```python
# File: src/records.py
class AccountRecord:
    def account_id(self) -> str: return "a"
class AddressRecord:
    def postal_code(self) -> int: return 1
class AuditRecord:
    def event_name(self) -> bool: return True
class SessionRecord:  # <- error
    def expires_at(self) -> float: return 1.0
    def report(self, account_id: str, postal_code: int, event_name: bool) -> None:
        print(account_id, postal_code, event_name, self.expires_at())
# File: cli.py
from src.records import AccountRecord, AddressRecord, AuditRecord, SessionRecord

if __name__ == "__main__":
    account = AccountRecord()
    address = AddressRecord()
    audit = AuditRecord()
    session = SessionRecord()
    session.report(account.account_id(), address.postal_code(), audit.event_name())
```

**Fix:** Move independent classes to focused files; keep one small exception hierarchy together when appropriate.

## Good


```python
# File: src/user_session.py
class UserSession:
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
        return "closed"
    def status_label(self) -> str:
        """Responsibilities: _session status_."""
        account = self._account_id.strip()
        if len(account) == 0: return "unavailable"
        return f"Account {account}"
    def report(self) -> None:
        """Responsibilities: _session reporting_."""
        refreshed = self.refresh()
        closed = self.close()
        label = self.status_label()
        print(refreshed, closed, label)
# File: cli.py
from src.user_session import UserSession

if __name__ == "__main__":
    session = UserSession("account-1")
    session.report()
```
