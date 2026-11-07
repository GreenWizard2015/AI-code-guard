# `unused-module-variable`

Description: Reports a module-level variable with no production symbol usage. Move owned state
behind an explicit owner or remove the unused variable.

## Bad


```python
# File: src/request_ledger.py
request_count = 0  # <- error

class RequestLedger:
    """Responsibilities: _request count reporting_."""

    def __init__(self, recorded_count: int) -> None:
        """Responsibilities: _ledger initialization_."""
        self._recorded_count: int = recorded_count

    def count(self) -> int:
        """Responsibilities: _request count access_."""
        return self._recorded_count

    def summary(self) -> str:
        """Responsibilities: _request summary formatting_."""
        return f"Recorded requests: {self.count()}"

    def report(self) -> None:
        """Responsibilities: _request report output_."""
        print(self.summary())
# File: cli.py
from src.request_ledger import RequestLedger

if __name__ == "__main__":
    ledger = RequestLedger(3)
    ledger.report()
```

## Good


```python
# File: src/request_ledger.py
class RequestLedger:
    """Responsibilities: _request count reporting_."""

    def __init__(self, recorded_count: int) -> None:
        """Responsibilities: _ledger initialization_."""
        self._recorded_count: int = recorded_count

    def count(self) -> int:
        """Responsibilities: _request count access_."""
        return self._recorded_count

    def populated(self) -> bool:
        """Responsibilities: _ledger activity classification_."""
        current_count = self._recorded_count
        return current_count > 0

    def remaining_slots(self, capacity: int) -> int:
        """Responsibilities: _remaining request capacity_."""
        available_slots = capacity - self._recorded_count
        if available_slots < 0:
            return 0
        return available_slots

    def summary(self) -> str:
        """Responsibilities: _request summary formatting_."""
        count = self.count()
        active = self.populated()
        remaining = self.remaining_slots(10)
        return f"Recorded requests: {count} (active={active}, available={remaining})"

    def report(self) -> None:
        """Responsibilities: _request report output_."""
        print(self.summary())
# File: cli.py
from src.request_ledger import RequestLedger

if __name__ == "__main__":
    ledger = RequestLedger(3)
    ledger.report()
```
