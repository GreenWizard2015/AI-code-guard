# `object-field-write`

Description: Assign only to `self._field` and its nested named fields.

## Bad

```python
# File: src/store.py
from __future__ import annotations
from src.state import State

class Store:
    def __init__(self) -> None:
        self._state: State = State()

    def update(self, other: Store) -> None:
        self.state = "public"  # <- error
        other._state.value = "foreign"  # <- error
        create_store().state = "temporary"  # <- error

    def ready(self) -> bool:
        return len(self._state.value) > 0

    def state_label(self) -> str:
        value = self._state.value
        return value.strip()

    def summary(self) -> str:
        state = "ready" if self.ready() else "empty"
        return f"{self.state_label()}: {state}"

    def report(self) -> None:
        print(f"Store: {self.summary()}")

def create_store() -> Store:
    return Store()
# File: src/state.py
class State:
    value: str = "ready"
# File: cli.py
from src.store import Store

if __name__ == "__main__":
    store = Store()
    store.update(Store())
    store.report()
```

## Good

```python
# File: src/store.py
from __future__ import annotations
from src.state import State

class Store:
    def __init__(self) -> None:
        self._state: State = State()

    def update(self) -> None:
        self._state.value = "updated"

    def ready(self) -> bool:
        return len(self._state.value) > 0

    def state_label(self) -> str:
        value = self._state.value
        return value.strip()

    def summary(self) -> str:
        state = "ready" if self.ready() else "empty"
        return f"{self.state_label()}: {state}"

    def report(self) -> None:
        print(f"Store: {self.summary()}")
# File: src/state.py
class State:
    value: str = "ready"
# File: cli.py
from src.store import Store

if __name__ == "__main__":
    store = Store()
    store.update()
    store.report()
```
