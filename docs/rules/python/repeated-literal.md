# repeated-literal

Description: Production code should not repeat the same non-trivial string literal two or
more times.

Bad:


Name the shared value or domain error once. If a matching project constant already
exists, every literal occurrence is reported as a use-the-constant violation,
even when it occurs only once. Otherwise, two or more production occurrences
are reported as a request to introduce a constant. The rule ignores strings
shorter than eight characters, standalone documentation strings, and test
files. Strings used as arguments or nested object, array, and collection values
are included at every depth.

## Bad


```python
# File: src/connection_notice.py
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
        return "connection is unavailable"  # <- error

    def operator_message(self) -> str:
        """Responsibilities: _operator status formatting_."""
        return "connection is unavailable"

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
