# `call-method`

Description: `__call__` makes an operation unclear at call sites.

```python
class Runner:
    result: Result

    def __init__(self, result: Result):
        self.result = result

    def __call__(self) -> Result: ...
```


Fix: Expose a descriptive method such as `run()` or `resolve()`.

## Bad

```python
# File: src/linting/runner.py
class StatusSummary:
    """Responsibilities: _status summary_."""

    def __init__(self, status: str) -> None:
        """Responsibilities: _summary initialization_."""
        self._status: str = status

    def __call__(self) -> str:
        """Responsibilities: _status resolution_."""
        return self._status.strip().lower()

    def label(self) -> str:
        """Responsibilities: _status label formatting_."""
        return f"Status: {self()}"

    def report(self) -> None:
        """Responsibilities: _status report output_."""
        print(self.label())
# File: cli.py
from src.linting.runner import StatusSummary

if __name__ == "__main__":
    status_summary = StatusSummary(" Ready ")
    status_summary.report()
```

## Good

```python
# File: src/status_summary.py
class StatusSummary:
    """Responsibilities: _status summary_."""

    def __init__(self, status: str) -> None:
        """Responsibilities: _summary initialization_."""
        self._status: str = status

    def resolved_status(self) -> str:
        """Responsibilities: _status resolution_."""
        return self._status.strip().lower()

    def status_length(self) -> int:
        """Responsibilities: _normalized status length_."""
        return len(self.resolved_status())

    def status_category(self) -> str:
        """Responsibilities: _status category selection_."""
        if self.resolved_status() == "ready":
            return "available"
        return "pending"

    def label(self) -> str:
        """Responsibilities: _status label formatting_."""
        return f"Status: {self.resolved_status()} ({self.status_category()}, {self.status_length()} characters)"

    def report(self) -> None:
        """Responsibilities: _status report output_."""
        print(self.label())
# File: cli.py
from src.status_summary import StatusSummary

if __name__ == "__main__":
    status_summary = StatusSummary(" Ready ")
    status_summary.report()
```
