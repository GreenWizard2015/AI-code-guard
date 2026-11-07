# `property`

Description: Keep behavior explicit. Python `@property` hides a method call behind attribute access.

```python
# File: src/service/service.py
class Service:
    loader: Loader

    def __init__(self, loader: Loader):
        self.loader = loader

    @property
    def status(self):
        return self.load_status()
```


Fix: Replace the property with an explicitly named method, such as `status()`.

## Bad

`@cached_property` is outside this rule.

```python
# File: src/service/service.py
class Service:
    def __init__(self, value: str) -> None:
        self._value: str = value

    def _normalized_status(self) -> str:
        trimmed = self._value.strip()
        if not trimmed:
            return "unknown"
        normalized = trimmed.lower()
        return normalized

    @property
    def status(self) -> str:
        return self._normalized_status()

    def ready(self) -> bool:
        current_status = self.status
        expected_status = "ready"
        return current_status == expected_status

    def report(self) -> str:
        status_text = self.status
        readiness = str(self.ready())
        output = f"{status_text} | {readiness}"
        print(output)
        return output
# File: cli.py
from src.service.service import Service

if __name__ == "__main__":
    service = Service(" READY ")
    service.report()
```

## Good

```python
# File: src/account_status.py
class AccountStatus:
    def __init__(self, value: str) -> None:
        self._value: str = value

    def status(self) -> str:
        trimmed = self._value.strip()
        if not trimmed:
            return "unknown"
        return trimmed.lower()

    def ready(self) -> bool:
        return self.status() == "ready"

    def report(self) -> str:
        status_text = self.status()
        readiness = str(self.ready())
        output = f"{status_text} | {readiness}"
        print(output)
        return output

# File: cli.py
from src.account_status import AccountStatus

if __name__ == "__main__":
    account_status = AccountStatus(" READY ")
    account_status.report()
```
