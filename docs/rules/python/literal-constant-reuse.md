# literal-constant-reuse

Description: Use an existing named constant when production code repeats its non-trivial
string value. The diagnostic is reported at each literal occurrence, including
when the value is used only once in the consuming callable.

Bad:


Good:


The rule applies to TypeScript and Python production code and ignores test
files and short strings.

## Bad


```python
# File: src/constants.py
CONNECTION_UNAVAILABLE_MESSAGE = "connection is unavailable"
# File: src/connection_notice.py
from src.constants import CONNECTION_UNAVAILABLE_MESSAGE

class ConnectionNotice:
    """Responsibilities: _connection status reporting_."""

    def __init__(self, channel: str) -> None:
        """Responsibilities: _notice initialization_."""
        self._channel: str = channel

    def channel_label(self) -> str:
        """Responsibilities: _channel label normalization_."""
        normalized = self._channel.strip()
        if not normalized:
            return "Unknown channel"
        return normalized.upper()

    def service_message(self) -> str:
        """Responsibilities: _service status formatting_."""
        return CONNECTION_UNAVAILABLE_MESSAGE

    def operator_message(self) -> str:
        """Responsibilities: _operator status formatting_."""
        return "connection is unavailable"  # <- error

    def summary(self) -> str:
        """Responsibilities: _connection summary formatting_."""
        return f"{self.channel_label()}: {self.service_message()} | {self.operator_message()}"

    def report(self) -> None:
        """Responsibilities: _connection report output_."""
        print(self.summary())
# File: cli.py
from src.connection_notice import ConnectionNotice

if __name__ == "__main__":
    notice = ConnectionNotice("Primary")
    notice.report()
```

## Good


```python
# File: src/constants.py
CONNECTION_UNAVAILABLE_MESSAGE: str = "connection is unavailable"
# File: src/connection_notice.py
from src.constants import CONNECTION_UNAVAILABLE_MESSAGE

class ConnectionNotice:
    """Responsibilities: _connection status reporting_."""

    def __init__(self, channel: str) -> None:
        """Responsibilities: _notice initialization_."""
        self._channel: str = channel

    def channel_label(self) -> str:
        """Responsibilities: _channel label normalization_."""
        normalized = self._channel.strip()
        if not normalized:
            return "Unknown channel"
        return normalized.upper()

    def service_message(self) -> str:
        """Responsibilities: _service status formatting_."""
        return CONNECTION_UNAVAILABLE_MESSAGE

    def operator_message(self) -> str:
        """Responsibilities: _operator status formatting_."""
        return CONNECTION_UNAVAILABLE_MESSAGE

    def summary(self) -> str:
        """Responsibilities: _connection summary formatting_."""
        return f"{self.channel_label()}: {self.service_message()} | {self.operator_message()}"

    def report(self) -> None:
        """Responsibilities: _connection report output_."""
        print(self.summary())
# File: cli.py
from src.connection_notice import ConnectionNotice

if __name__ == "__main__":
    notice = ConnectionNotice("Primary")
    notice.report()
```
