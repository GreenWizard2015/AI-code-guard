# `shared-parameter-type`

Description: Repeated use of one project reference type can signal behavior that belongs at a
shared domain boundary. Treat the diagnostic as a refactoring prompt, not an automatic request for
a wrapper.

Top-level functions are grouped project-wide; methods are grouped only within their declaring
class. Test and private methods do not count. Primitive parameters alone do not trigger this rule.
Resolve aliases and inspect all callers before moving behavior.

## Bad

Four operations repeatedly accept the same endpoint and separately interpret its data.


```python
# File: src/endpoint.py
class Endpoint:

    def __init__(self, scheme: str, host: str, path: str) -> None:
        self.scheme: str = scheme
        self.host: str = host
        self.path: str = path

# File: src/endpoint_operations.py
from src.endpoint import Endpoint

def endpoint_origin(endpoint: Endpoint) -> str:
    return f"{endpoint.scheme.lower()}://{endpoint.host.lower()}"

def endpoint_host(endpoint: Endpoint) -> str:
    return endpoint.host.lower()

def endpoint_path(endpoint: Endpoint) -> str:
    return endpoint.path.strip().rstrip("/")

def endpoint_secure(endpoint: Endpoint) -> bool:
    return endpoint.scheme.lower() == "https"

# File: cli.py
from src.endpoint import Endpoint
from src.endpoint_operations import endpoint_host, endpoint_origin, endpoint_path, endpoint_secure

if __name__ == "__main__":
    endpoint = Endpoint("HTTPS", "example.test", "/api/")
    print(endpoint_origin(endpoint), endpoint_host(endpoint), endpoint_path(endpoint), endpoint_secure(endpoint))
```

## Good

Move those operations onto the value they interpret. The same inputs produce the same outputs;
callers no longer pass `Endpoint` repeatedly.


```python
# File: src/endpoint/endpoint.py
class Endpoint:
    """Responsibilities: _endpoint state and interpretation_."""

    def __init__(self, scheme: str, host: str, path: str) -> None:
        self.scheme: str = scheme.lower()
        self.host: str = host.lower()
        self.path: str = path.strip()

    def origin(self) -> str:
        """Responsibilities: _endpoint origin interpretation_."""
        return f"{self.scheme}://{self.host}"

    def normalized_path(self) -> str:
        """Responsibilities: _endpoint path normalization_."""
        path = self.path
        while path.endswith("/"):
            path = path[:-1]
        return path

    def secure(self) -> bool:
        """Responsibilities: _secure endpoint classification_."""
        return self.scheme == "https"

# File: cli.py
from src.endpoint.endpoint import Endpoint

if __name__ == "__main__":
    endpoint = Endpoint("HTTPS", "example.test", "/api/")
    print(endpoint.origin(), endpoint.host, endpoint.normalized_path(), endpoint.secure())
```
