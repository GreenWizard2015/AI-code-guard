# responsibilities-max-count

Description: Detect an owner whose `Responsibilities:` line hides a boundary that is too broad for one contract.

Split the owner or method into focused boundaries and keep each child responsibility under the correct parent. Do not merge unrelated work into a vague label or remove meaningful responsibilities to silence the rule.

## Bad


```python
# File: src/account_session.py
class AccountSession:
    """Responsibilities: _account identity_, _session state_."""
    def refresh(self, account_id: str) -> str:
        """Responsibilities: _account validation_, _session renewal_, _failure notification_."""
        return account_id.strip()
    def report(self) -> None:
        """Responsibilities: _session report output_."""
        print(self.refresh("account-1"))
# File: cli.py
from src.account_session import AccountSession

if __name__ == "__main__":
    session = AccountSession()
    session.report()
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
        session_state = [self.refresh(), self.close(), self.status_label()]
        print(" | ".join(session_state))
# File: cli.py
from src.user_session import UserSession

if __name__ == "__main__":
    session = UserSession("account-1")
    session.report()
```
