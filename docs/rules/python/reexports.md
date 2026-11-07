# `reexports`

Description: Re-exporting imported symbols obscures the defining module.

Before:



After:


Fix: Import `Client` from its defining module at the use site. Update all callers before removing a facade, and keep an entry-point export only when it is part of the intentional external API.

Registry example:



Do not preserve an internal compatibility alias just to avoid updating callers.
The rule also rejects type-only re-exports; import the type from its defining module instead.

```python
# feature.py
from .client import Client

__all__ = ['Client']
```

## Bad


```python
# File: src/client.py
class Client:
    def __init__(self, client_id: str) -> None:
        self._client_id: str = client_id

    def connection_label(self) -> str:
        return f"Connected {self._client_id}"

    def status_label(self) -> str:
        return f"Client {self._client_id} is ready"

    def report(self) -> None:
        print(f"{self.connection_label()} | {self.status_label()}")
# File: src/feature.py
from src.client import Client  # <- error

__all__ = ["Client"]
# File: cli.py
from src.feature import Client

if __name__ == "__main__":
    client = Client("primary")
    client.report()
```

## Good


```python
# File: src/account_profile.py
class AccountProfile:
    def __init__(self, given_name: str, family_name: str, access_level: str) -> None:
        self._given_name: str = given_name
        self._family_name: str = family_name
        self._access_level: str = access_level

    def full_name(self) -> str:
        return f"{self._given_name} {self._family_name}"

    def normalized_name(self) -> str:
        return self.full_name().strip().lower()

    def access_label(self) -> str:
        return f"Access: {self._access_level.upper()}"

    def display_label(self) -> str:
        return f"{self.full_name()} ({self.access_label()})"

    def summary(self) -> str:
        return f"{self.display_label()} [{self.normalized_name()}]"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.account_profile import AccountProfile

if __name__ == "__main__":
    profile = AccountProfile("Ada", "Lovelace", "editor")
    profile.report()
```
