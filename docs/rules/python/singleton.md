# `singleton`

Description: A module-level class instance or Python `ClassVar` creates hidden shared state.


Fix: Construct dependencies at the composition root and inject them into consumers.

```python
class Registry:
    entries: ClassVar[dict[str, str]] = {}
```

Move class-level mutable state to an explicitly owned instance. Use a module-level immutable
constant only for genuinely shared configuration.

## Bad


```python
from typing import ClassVar
class UserSession:
    sessions: ClassVar[list[str]] = []  # <- error
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
