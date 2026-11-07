# `runtime-patching`

Description: Do not replace existing behavior or data. Inject a dependency implementation through its protocol.

## Bad

```python
# File: src/gateway.py
class Gateway:
    """Responsibilities: _gateway response delivery_."""

    def send(self) -> str:
        """Responsibilities: _gateway response_."""
        return "ready"
    def replace_behavior(self) -> None:
        """Responsibilities: _gateway behavior replacement_."""
        self.send = lambda: "fake"  # <- error
        print(self.send())
# File: cli.py
from src.gateway import Gateway

if __name__ == "__main__":
    Gateway().replace_behavior()
```

## Good

```python
# File: src/protocols.py
from typing import Protocol

class GatewayContract(Protocol):
    """Responsibilities: _gateway response contract_."""

    def send(self) -> str: ...

# File: src/in_memory_gateway.py
from src.protocols import GatewayContract

class InMemoryGateway(GatewayContract):
    """Responsibilities: _injected gateway response_."""

    def __init__(self, label: str, response: str, prefix: str) -> None:
        """Responsibilities: _in-memory response ownership_."""
        self._label: str = label
        self._response: str = response
        self._prefix: str = prefix

    def send(self) -> str:
        """Responsibilities: _gateway response_."""
        label = self._label.strip()
        response = self._response.strip()
        if not response:
            return self._prefix + ": " + label + ": unavailable"
        return self._prefix + ": " + label + ": " + response

# File: src/gateway_application.py
from src.in_memory_gateway import InMemoryGateway
from src.protocols import GatewayContract

class GatewayApplication:
    """Responsibilities: _gateway response application_."""

    def __init__(self, label: str, payload: str, prefix: str) -> None:
        """Responsibilities: _gateway composition ownership_."""
        self._gateway: GatewayContract = InMemoryGateway(label, payload, prefix)

    def response(self) -> str:
        """Responsibilities: _application response selection_."""
        response = self._gateway.send()
        if not response:
            return "No gateway response"
        return response

    def status(self) -> str:
        """Responsibilities: _application status selection_."""
        response = self.response()
        if response:
            return "ready"
        return "unavailable"

    def report(self) -> None:
        """Responsibilities: _application response reporting_."""
        status = self.status()
        response = self.response()
        print(status + ": " + response)
# File: cli.py
from src.gateway_application import GatewayApplication

if __name__ == "__main__":
    application = GatewayApplication("Example gateway", "response payload", "Local")
    application.report()
```
