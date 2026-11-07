# `duplicate-type-shape`

Description: Reports named types with matching sorted field/type and base signatures, independent of field order.
Python classes with different native bases remain distinct.

## Bad

```python
{% const response_types = [{"name":"JsonResponse","label":"JSON"},{"name":"TextResponse","label":"TEXT"}] %}
# File: src/response_types.py
{%for response in response_types %}
class {{response.name}}:
    """Represent one {{response.label}} response."""
    status: int
    payload: str

    def __init__(self, status: int, payload: str) -> None:
        self.status: int = status
        self.payload: str = payload

    def payload_length(self) -> int:
        """Count visible payload characters."""
        normalized_payload = self.payload.strip()
        return len(normalized_payload)

    def summary(self) -> str:
        """Format this response for its caller."""
        normalized_payload = self.payload.strip()
        status_text = str(self.status)
        payload_length = self.payload_length()
        return f"{{response.label}} {status_text} {normalized_payload} ({payload_length})"

    def report(self, fragment: str) -> None:
        """Write the response summary."""
        print(self.summary(), fragment)
{% endfor %}

# File: tests/response_types/test_response_types.py
import unittest
from src.response_types import JsonResponse, TextResponse

class TestResponseTypes(unittest.TestCase):
    """Check response field and formatting behavior."""

    def test_summary(self) -> None:
        status_code = 201
        payload = "created"
        response = JsonResponse(status_code, payload)
        self.assertEqual(response.summary(), "JSON 201 created (7)")

    def test_status_and_payload(self) -> None:
        response = TextResponse(202, "queued")
        self.assertEqual(response.summary(), "TEXT 202 queued (6)")

# File: cli.py
from src.response_types import JsonResponse, TextResponse

if __name__ == "__main__":
    status_code = 200
    payload = "ready"
    marker = "ready"
    json_response = JsonResponse(status_code, payload)
    text_response = TextResponse(status_code, payload)
    json_response.report(marker)
    text_response.report(marker)
```

## Good

```python
# File: src/response.py
class Response:
    """Represent one response and its public status."""

    status: int
    payload: str

    def __init__(self, status: int, payload: str) -> None:
        self._status: int = status
        self._payload: str = payload

    def payload_length(self) -> int:
        """Count visible payload characters."""
        normalized_payload = self._payload.strip()
        return len(normalized_payload)

    def summary(self) -> str:
        """Format a response for its caller."""
        normalized_payload = self._payload.strip()
        status_text = str(self._status)
        payload_length = self.payload_length()
        return f"RESPONSE {status_text} {normalized_payload} ({payload_length})"

    def report(self, fragment: str) -> None:
        """Write the response summary."""
        print(self.summary(), fragment)

# File: tests/response/test_response.py
import unittest
from src.response import Response

class TestResponse(unittest.TestCase):
    """Check response behavior at the public boundary."""

    def test_summary(self) -> None:
        status_code = 201
        payload = "created"
        response = Response(status_code, payload)
        self.assertEqual(response.summary(), "RESPONSE 201 created (7)")

    def test_status_and_payload(self) -> None:
        response = Response(202, "queued")
        self.assertEqual(response.summary(), "RESPONSE 202 queued (6)")

# File: cli.py
from src.response import Response

if __name__ == "__main__":
    status_code = 200
    payload = "ready"
    marker = "ready"
    response = Response(status_code, payload)
    response.report(marker)
```
