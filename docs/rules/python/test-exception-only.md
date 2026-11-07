# `test-exception-only`

Description: Tests must verify a result or observable behavior. A test that only checks
that an operation throws verifies an implementation detail instead of the behavior
visible to its caller.

Prefer asserting the observable result at the next public boundary. If a direct return
value does not exist, assert the state change, emitted event, or persisted record visible
to the caller.

## Bad

```python
# File: src/request.py
class Request:
    def __init__(self) -> None:
        self._responses: list[str] = []

    def response_for(self, input_value: str) -> str:
        if not input_value:
            raise ValueError("Invalid request")
        response = f"200: {input_value}"
        self._responses.append(response)
        return response

    def response_count(self) -> int:
        return len(self._responses)

    def latest_response(self) -> str:
        if not self._responses:
            return "No response"
        return self._responses[-1]

    def report(self, input_value: str) -> None:
        self.response_for(input_value)
        print(f"{self.latest_response()} ({self.response_count()})")
# File: tests/request/test_request.py
import unittest
from src.request import Request

class TestRequest(unittest.TestCase):
    def test_rejects_empty_input_by_exception(self) -> None:
        request = Request()
        self.assertRaises(ValueError, request.response_for, "")  # <- error

    def test_returns_a_response_for_a_valid_request(self) -> None:
        request = Request()
        self.assertEqual(request.response_for("ready"), "200: ready")
# File: src/cli.py
from src.request import Request

if __name__ == "__main__":
    request = Request()
    request.report("ready")
```

## Good

```python
# File: src/request.py
class Request:
    def __init__(self) -> None:
        self._responses: list[str] = []

    def response_for(self, input_value: str) -> str:
        if not input_value:
            response = "400: Invalid request"
        else:
            response = f"200: {input_value}"
        self._responses.append(response)
        return response

    def response_count(self) -> int:
        return len(self._responses)

    def latest_response(self) -> str:
        if not self._responses:
            return "No response"
        return self._responses[-1]

    def report(self, input_value: str) -> None:
        self.response_for(input_value)
        print(f"{self.latest_response()} ({self.response_count()})")
# File: tests/request/test_request.py
import unittest
from src.request import Request

class TestRequest(unittest.TestCase):
    def test_returns_bad_request_for_empty_input(self) -> None:
        request = Request()
        self.assertEqual(request.response_for(""), "400: Invalid request")
        self.assertEqual(request.response_count(), 1)

    def test_returns_success_response_for_nonempty_input(self) -> None:
        request = Request()
        self.assertEqual(request.response_for("ready"), "200: ready")
# File: src/cli.py
from src.request import Request

if __name__ == "__main__":
    request = Request()
    request.report("ready")
```
