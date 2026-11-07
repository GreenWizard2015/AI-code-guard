# `sys-path-mutation`

Description: Configure import paths through the project environment or test runner instead of mutating `sys.path`.

## Bad

```python
# File: src/import_configuration.py
import sys

class ImportConfiguration:
    def __init__(self) -> None:
        self.search_paths = sys.path

    def add_import_root(self, path: str) -> None:
        self.search_paths.append(path)
        configured_paths = self.search_paths
        configured_paths.append(path)
# File: src/status_report.py
class StatusReport:
    def __init__(self, status: str, attempts: int) -> None:
        self._status: str = status.strip()
        self._attempts: int = attempts
    def status_label(self) -> str:
        normalized_status = self._status.strip().lower()
        if not normalized_status:
            return "status: unknown"
        return f"status: {normalized_status}"
    def readiness_label(self) -> str:
        if self._status.strip().lower() == "ready":
            return "available"
        return "waiting"
    def attempt_summary(self) -> str:
        if self._attempts < 0:
            return "attempts: unavailable"
        return f"attempts: {self._attempts}"
    def report(self) -> None:
        print(
            f"{self.status_label()}, {self.readiness_label()}, "
            f"{self.attempt_summary()}"
        )
# File: cli.py
from src.status_report import StatusReport

if __name__ == "__main__":
    report = StatusReport("ready", 1)
    report.report()
```

The instance field and its local alias still mutate the process-wide import path.

## Good

```python
# File: src/status_report.py
class StatusReport:
    def __init__(self, status: str, attempts: int) -> None:
        self._status: str = status.strip()
        self._attempts: int = attempts
    def status_label(self) -> str:
        normalized_status = self._status.strip().lower()
        if not normalized_status:
            return "status: unknown"
        return f"status: {normalized_status}"
    def readiness_label(self) -> str:
        if self._status.strip().lower() == "ready":
            return "available"
        return "waiting"
    def attempt_summary(self) -> str:
        if self._attempts < 0:
            return "attempts: unavailable"
        return f"attempts: {self._attempts}"
    def report(self) -> None:
        print(
            f"{self.status_label()}, {self.readiness_label()}, "
            f"{self.attempt_summary()}"
        )
# File: cli.py
from src.status_report import StatusReport

if __name__ == "__main__":
    report = StatusReport("ready", 1)
    report.report()
```

Configure import roots through the project environment or test runner instead.
