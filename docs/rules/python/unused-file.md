# `unused-file`

Description: Remove an unused source file or add a real production or test import for it.

## Bad


```python
# File: src/unused_notes.py
# This source module is deliberately left unimported.
# File: src/status.py
class Status:
    def __init__(self, status: str) -> None:
        self._status: str = status

    def normalized_status(self) -> str:
        return self._status.strip().lower()

    def status_label(self) -> str:
        return f"Status: {self.normalized_status()}"

    def report(self) -> None:
        print(self.status_label())
# File: cli.py
from src.status import Status

if __name__ == "__main__":
    status = Status(" READY ")
    status.report()
```

## Good


```python
# File: src/domain/status.py
class Status:
    def __init__(self, value: str) -> None:
        self._value: str = value
    def normalized(self) -> str:
        trimmed = self._value.strip()
        normalized_value = trimmed.lower()
        return normalized_value
    def ready(self) -> bool:
        normalized_value = self.normalized()
        expected_value = 'ready'
        return normalized_value == expected_value
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        return normalized_fragment in self.normalized()
    def report(self) -> None:
        print(f"{self.label('State')} | {self.ready()} | {self.contains('ead')}")
# File: cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    status.report()
```
