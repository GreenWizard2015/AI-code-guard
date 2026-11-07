# `nested-type`

Description: Type declarations must be top-level so their ownership and reuse remain visible.
The rule covers TypeScript type aliases, interfaces, and enums, plus Python `TypeAlias`,
`TypeAliasType`, and structural type declarations nested inside classes, functions, or other
scopes. Nested classes are reported separately by `nested-class`.

Fix: Move each type declaration to a focused top-level module and import it where needed.

## Bad


```python
# File: src/status_reporter.py
class StatusReporter:

    def __init__(self, heading: str, value: str) -> None:
        self._heading: str = heading
        self._value: str = value

    def classify(self) -> str:
        normalized = self.normalize()
        state = "unknown"
        if normalized == "ready":
            state = "ready"
        if normalized == "blocked":
            state = "blocked"
        return state

    def label(self) -> str:
        normalized = self.normalize()
        return f"{self._heading}: {normalized}"

    def normalize(self) -> str:
        words = self._value.strip().lower().split()
        return " ".join(words)

    def report(self) -> None:
        summary = self.summary()
        length = len(self.normalize())
        print(f"{summary} ({length} characters)")

    def summary(self) -> str:
        label = self.label()
        state = self.classify()
        return f"{label} [{state}]"
# File: cli.py
from typing import Literal, TypeAlias
from src.status_reporter import StatusReporter

if __name__ == "__main__":
    status: TypeAlias = Literal["ready", "blocked"]
    value: status = "ready"
    reporter = StatusReporter("Status", value)
    reporter.report()
```

## Good


```python
# File: src/status_reporter.py
class StatusReporter:

    def __init__(self, heading: str, value: str) -> None:
        self._heading: str = heading
        self._value: str = value

    def classify(self) -> str:
        normalized = self.normalize()
        state = "unknown"
        if normalized == "ready":
            state = "ready"
        if normalized == "blocked":
            state = "blocked"
        return state

    def label(self) -> str:
        normalized = self.normalize()
        return f"{self._heading}: {normalized}"

    def normalize(self) -> str:
        words = self._value.strip().lower().split()
        return " ".join(words)

    def report(self) -> None:
        summary = self.summary()
        length = len(self.normalize())
        print(f"{summary} ({length} characters)")

    def summary(self) -> str:
        label = self.label()
        state = self.classify()
        return f"{label} [{state}]"
# File: src/types.py
from typing import Literal, TypeAlias

Status: TypeAlias = Literal["ready", "blocked"]
# File: cli.py
from src.status_reporter import StatusReporter
from src.types import Status

if __name__ == "__main__":
    value: Status = "ready"
    reporter = StatusReporter("Status", value)
    reporter.report()
```
