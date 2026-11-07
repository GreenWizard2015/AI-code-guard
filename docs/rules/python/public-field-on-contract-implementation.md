# Public field on contract implementation

Description: Classes implementing a protocol keep their state private and expose behavior through the contract.

## Bad

```python
# File: src/protocols.py
from typing import Protocol

class StoreContract(Protocol):
    def read(self) -> str:
        raise NotImplementedError
# File: src/store.py
from src.protocols import StoreContract

class Store(StoreContract):
    state: str  # <- error

    def __init__(self, state: str) -> None:
        self.state = state

    def read(self) -> str:
        return self.state.strip().upper()

    def report(self) -> None:
        current_state = self.read()
        print(current_state)
# File: cli.py
from src.store import Store

if __name__ == "__main__":
    store = Store("ready")
    store.report()
```

## Good

```python
# File: src/protocols.py
from typing import Protocol

class StoreContract(Protocol):
    def status_label(self) -> str: ...

    def status_length(self) -> int: ...

    def ready(self) -> bool: ...

    def prefix_matches(self, prefix: str) -> bool: ...
# File: src/store.py
from src.protocols import StoreContract

class Store(StoreContract):
    def __init__(self, status: str) -> None:
        self._status: str = status

    def status_label(self) -> str:
        normalized = self._status.strip()
        if len(normalized) == 0:
            return "unknown"
        return normalized.upper()

    def status_length(self) -> int:
        length = 0
        for character in self._status:
            if character.strip():
                length += 1
        return length

    def ready(self) -> bool:
        normalized = self._status.strip().lower()
        return normalized == "ready"

    def prefix_matches(self, prefix: str) -> bool:
        normalized_prefix = prefix.strip().lower()
        normalized_status = self._status.strip().lower()
        if len(normalized_prefix) == 0:
            return False
        return normalized_status.startswith(normalized_prefix)

    def report(self) -> None:
        label = self.status_label()
        length = self.status_length()
        ready = self.ready()
        prefixed = self.prefix_matches("rea")
        print(f"{label} | length={length} | ready={ready} | prefix={prefixed}")
# File: cli.py
from src.store import Store

if __name__ == "__main__":
    store = Store("ready")
    store.report()
```
