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
# File: src/user_session.py
class UserSession:
    def __init__(self) -> None:
        self._account_id: str = "account-1"

    def refresh(self) -> str:
        return f"refreshed {self._account_id}"

    def close(self) -> str:
        return f"closed {self._account_id}"

    def status_label(self) -> str:
        return f"Account {self._account_id}"

    def report(self) -> None:
        print(f"{self.refresh()} | {self.close()} | {self.status_label()}")

SESSION = UserSession()  # <- error
# File: cli.py
from src.user_session import SESSION

if __name__ == "__main__":
    SESSION.report()
```

## Good


```python
# File: src/user_session.py
class UserSession:
    def __init__(self, account_id: str) -> None:
        self._account_id: str = account_id

    def refresh(self) -> str:
        account = self._account_id.strip()
        if len(account) == 0:
            return "invalid"
        return "refreshed"

    def close(self) -> str:
        return f"closed {self._account_id.strip()}"

    def status_label(self) -> str:
        account = self._account_id.strip()
        if len(account) == 0:
            return "unavailable"
        return f"Account {account}"
    def report(self) -> None:
        print(f"{self.refresh()} | {self.close()} | {self.status_label()}")
# File: cli.py
from src.user_session import UserSession

if __name__ == "__main__":
    session = UserSession("account-1")
    session.report()
```
