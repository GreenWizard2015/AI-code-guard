# Finite variant mapping is incomplete

Description: Map every member of a known finite source type explicitly when converting it to another finite type.

## Bad

```python
# File: src/status_mapper.py
from __future__ import annotations

from enum import Enum

class SourceState(Enum):
    READY: str = "ready"
    FAILED: str = "failed"
    PENDING: str = "pending"

    def map_state(self, value: SourceState) -> TargetState:
        match value:
            case SourceState.READY:
                return TargetState.AVAILABLE
            case _:
                return TargetState.ERROR  # <- error

    def report(self) -> None:
        target_state = self.map_state(self)
        print(target_state.value)

class TargetState(Enum):
    AVAILABLE: str = "available"
    ERROR: str = "error"
    WAITING: str = "waiting"
# File: cli.py
from src.status_mapper import SourceState

if __name__ == "__main__":
    SourceState.READY.report()
```

## Good

```python
# File: src/status_mapper.py
from __future__ import annotations

from enum import Enum

class SourceState(Enum):
    READY: str = "ready"
    FAILED: str = "failed"
    PENDING: str = "pending"

    def map_state(self, value: SourceState) -> TargetState:
        match value:
            case SourceState.READY:
                return TargetState.AVAILABLE
            case SourceState.FAILED:
                return TargetState.ERROR
            case SourceState.PENDING:
                return TargetState.WAITING

    def report(self) -> None:
        target_state = self.map_state(self)
        print(target_state.value)

class TargetState(Enum):
    AVAILABLE: str = "available"
    ERROR: str = "error"
    WAITING: str = "waiting"
# File: cli.py
from src.status_mapper import SourceState

if __name__ == "__main__":
    SourceState.READY.report()
```
