# responsibilities

Description: Require every class, interface, type, method, and function to state its real ownership boundary in a docstring.

Use one line in the declaration documentation:

```text
Responsibilities: _parse input, normalize input_, _validate state_.
```

In TypeScript doc comments, close the documentation with `**/`, not `*/`.

Keep the list concise and comma-separated. Wrap every responsibility in paired `_` characters; commas inside a wrapped responsibility are allowed. Interface methods are excluded because the interface contract is the documented boundary.

Write responsibilities as short noun phrases naming the owned work, not as descriptions of a return value or a condition. For example, use `_user validation_`, not `_returns whether the user is valid_`.

Do not invent generic labels, hide multiple responsibilities in one phrase, or use the line only to silence the diagnostic. Split the owner when its responsibilities cannot be named honestly within the limit.

## Bad


```python
class Validator:  # <- error
    pass
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
