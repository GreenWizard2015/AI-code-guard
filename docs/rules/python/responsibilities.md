# responsibilities

Description: Require every class, interface, type, method, and function to state its real ownership boundary in a docstring.

Use exactly one `Responsibilities:` line in each declaration's documentation. Put every responsibility on that line:

```text
Responsibilities: _parse input, normalize input_, _validate state_.
```

Keep the list concise and comma-separated. Wrap every responsibility in paired `_` characters; commas inside a wrapped responsibility are allowed. Interface methods are excluded because the interface contract is the documented boundary.

Each phrase must name an explicit object and the work owned for it, using at least two words: `_source parsing_`, not `_parsing_`. Do not split one declaration's responsibilities across multiple lines.

Write responsibilities as short noun phrases naming the owned work, not as descriptions of a return value or a condition. For example, use `_user validation_`, not `_returns whether the user is valid_`.

Do not invent generic labels, hide multiple responsibilities in one phrase, or use the line only to silence the diagnostic. Split the owner when its responsibilities cannot be named honestly within the limit.

## Bad


```python
# File: src/validator.py
class Validator:
    """Responsibilities: _account handling_.
    Responsibilities: _session handling_."""
    def __init__(self, value: str) -> None:
        self._value: str = value

    def validation_label(self) -> str:
        """Responsibilities: _validation_."""
        return f"Validated {self._value.strip()}"

    def report(self) -> None:
        """Responsibilities: _validation report output_."""
        print(self.validation_label())
# File: cli.py
from src.validator import Validator

if __name__ == "__main__":
    validator = Validator("ready")
    validator.report()
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
