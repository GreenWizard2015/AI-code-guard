# `conditional-type-alias`

Description: See the examples below for the rule behavior.

## Bad

```python
# File: src/types.py
from typing import TypeAlias

if True:
    InputValue: TypeAlias = str | int

# File: src/input_value_record.py
from src.types import InputValue

class InputValueRecord:
    def __init__(self, value: InputValue, kind: str) -> None:
        self._value: InputValue = value
        self._kind: str = kind

    def value_kind(self) -> str:
        return self._kind

    def rendered_value(self) -> str:
        return str(self._value)

    def summary(self) -> str:
        return f"{self.value_kind()}: {self.rendered_value()} ({len(self.rendered_value())})"

    def empty(self) -> bool:
        return len(self.rendered_value()) == 0

    def report(self) -> None:
        print(f"{self.summary()} empty={self.empty()}")
# File: cli.py
from src.input_value_record import InputValueRecord
from src.types import InputValue

if __name__ == "__main__":
    value: InputValue = "ready"
    record = InputValueRecord(value, "text")
    record.report()
```

Define type aliases unconditionally. Type-shaped assignments inside any conditional branch are
reported; ordinary runtime assignments in branches remain allowed.

## Good

```python
# File: src/types.py
from typing import TypeAlias

InputValue: TypeAlias = str | int

# File: src/input_value_record.py
from src.types import InputValue

class InputValueRecord:
    def __init__(self, value: InputValue, kind: str) -> None:
        self._value: InputValue = value
        self._kind: str = kind

    def value_kind(self) -> str:
        return self._kind

    def rendered_value(self) -> str:
        return str(self._value)

    def summary(self) -> str:
        return f"{self.value_kind()}: {self.rendered_value()} ({len(self.rendered_value())})"

    def empty(self) -> bool:
        return len(self.rendered_value()) == 0

    def report(self) -> None:
        print(f"{self.summary()} empty={self.empty()}")
# File: cli.py
from src.input_value_record import InputValueRecord
from src.types import InputValue

if __name__ == "__main__":
    value: InputValue = "ready"
    record = InputValueRecord(value, "text")
    record.report()
```
