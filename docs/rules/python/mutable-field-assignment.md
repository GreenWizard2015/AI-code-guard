# `mutable-field-assignment`

Description: Mutation outside construction makes object state hard to reason about.

Keep state in a named state contract and class. Make a transition return a new
state instance instead of assigning to the existing instance's fields.

## Bad


```python
# File: src/cache_state/cache_state.py
class CacheState:
    def __init__(self, value: str, revision: int) -> None:
        self._value: str = value
        self._revision: int = revision

    def with_value(self, value: str) -> None:
        self._value = value.strip()
        self._revision += 1

    def summary(self) -> str:
        return f"{self._value}:{self._revision}"

# File: src/cache_state/cli.py
from src.cache_state.cache_state import CacheState

if __name__ == "__main__":
    state = CacheState("", 0)
    state.with_value("ready")
    print(state.summary())
```

## Good


```python
# File: src/cache_state/protocols.py
from __future__ import annotations
from typing import Protocol

class CacheStateContract(Protocol):
    def with_value(self, value: str) -> CacheStateContract: ...
    def summary(self) -> str: ...
# File: src/cache_state/cache_state.py
from src.cache_state.protocols import CacheStateContract

class CacheState(CacheStateContract):
    def __init__(self, value: str, revision: int) -> None:
        self._value: str = value
        self._revision: int = revision

    def with_value(self, value: str) -> CacheStateContract:
        next_value = value.strip()
        next_revision = self._revision + 1
        return CacheState(next_value, next_revision)

    def summary(self) -> str:
        return f"{self._value}:{self._revision}"

# File: src/cache_state/cli.py
from src.cache_state.cache_state import CacheState
from src.cache_state.protocols import CacheStateContract

if __name__ == "__main__":
    state: CacheStateContract = CacheState("", 0)
    state = state.with_value("ready")
    print(state.summary())
```
