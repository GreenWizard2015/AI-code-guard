# `unused-type`

Description: Reports a type declaration with no production symbol usage. Test-only references
do not keep a production type alive.

## Bad


```python
# File: src/types.py
from typing import TypeAlias

MessageStatus: TypeAlias = str  # <- error
# File: src/message_status_reporter.py
class MessageStatusReporter:
    """Responsibilities: _message status reporting_."""

    def __init__(self, status: str) -> None:
        """Responsibilities: _reporter initialization_."""
        self._status: str = status

    def normalized_status(self) -> str:
        """Responsibilities: _status normalization_."""
        return self._status.strip().lower()

    def status_label(self) -> str:
        """Responsibilities: _status labeling_."""
        return f"Message status: {self.normalized_status()}"

    def status_code(self) -> int:
        """Responsibilities: _status code selection_."""
        codes = {"queued": 10, "delivered": 20}
        normalized = self.normalized_status()
        return codes.get(normalized, 0)

    def status_summary(self) -> str:
        """Responsibilities: _status summary composition_."""
        label = self.status_label()
        code = self.status_code()
        return f"{label} [{code}]"

    def report(self) -> None:
        """Responsibilities: _status output_."""
        summary = self.status_summary()
        print(summary)
# File: cli.py
from src.message_status_reporter import MessageStatusReporter

if __name__ == "__main__":
    reporter = MessageStatusReporter("queued")
    reporter.report()
```

## Good


```python
# File: src/types.py
from typing import TypeAlias

MessageStatus: TypeAlias = str
# File: src/message_status_reporter.py
from src.types import MessageStatus

class MessageStatusReporter:
    """Responsibilities: _message status reporting_."""

    def __init__(self, status: MessageStatus) -> None:
        """Responsibilities: _reporter initialization_."""
        self._status: MessageStatus = status

    def normalized_status(self) -> str:
        """Responsibilities: _status normalization_."""
        return self._status.strip().lower()

    def status_label(self) -> str:
        """Responsibilities: _status labeling_."""
        return f"Message status: {self.normalized_status()}"

    def status_code(self) -> int:
        """Responsibilities: _status code selection_."""
        codes = {"queued": 10, "delivered": 20}
        normalized = self.normalized_status()
        return codes.get(normalized, 0)

    def status_summary(self) -> str:
        """Responsibilities: _status summary composition_."""
        label = self.status_label()
        code = self.status_code()
        return f"{label} [{code}]"

    def report(self) -> None:
        """Responsibilities: _status output_."""
        summary = self.status_summary()
        print(summary)
# File: cli.py
from src.message_status_reporter import MessageStatusReporter

if __name__ == "__main__":
    reporter = MessageStatusReporter("queued")
    reporter.report()
```
