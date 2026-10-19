# `mixin`

Description: Mixins assemble implementation through inheritance, hiding ownership and state boundaries.

Before:



After:


Fix: Move behavior into a focused collaborator and inject it through composition. Use a narrow interface or protocol for a shared contract instead of inheriting implementation.

## Bad


```python
class Service(LoggingMixin):  # <- error
    pass
```

```python
class LoggingMixin:
    def log(self, message: str) -> None:
        print(message)

class Client(LoggingMixin):
    pass
```

## Good


```python
# File: src/protocols.py
from typing import Protocol
class HttpConnectionContract(Protocol):
    def send(self, message: str) -> str: ...
    def cancel(self, request_id: str) -> str: ...
    def connection_state(self) -> str: ...
# File: src/http_connection.py
from logging import Logger, getLogger
from src.protocols import HttpConnectionContract
class HttpConnection(HttpConnectionContract):
    """Responsibilities: _HTTP request state and logging_."""
    def __init__(self, logger: Logger, host_name: str) -> None:
        """Responsibilities: _connection initialization_."""
        self.logger: Logger = logger
        self.host_name: str = host_name
    def send(self, message: str) -> str:
        """Responsibilities: _request submission_."""
        normalized = message.strip()
        if len(normalized) == 0: return "ignored"
        self.logger.info(f"{self.host_name}: {normalized}")
        return "sent"
    def cancel(self, request_id: str) -> str:
        """Responsibilities: _request cancellation_."""
        normalized_id = request_id.strip()
        if len(normalized_id) == 0: return "ignored"
        self.logger.info(f"{self.host_name} cancelled {normalized_id}")
        return "cancelled"
    def connection_state(self) -> str:
        """Responsibilities: _connection state reporting_."""
        if len(self.host_name.strip()) == 0: return "offline"
        return "connected"
# File: cli.py
from logging import getLogger
from src.http_connection import HttpConnection
if __name__ == "__main__":
    connection = HttpConnection(getLogger("requests"), "web")
    print(connection.send("hello"), connection.cancel("request-1"), connection.connection_state())
```
