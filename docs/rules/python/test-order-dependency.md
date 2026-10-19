# test-order-dependency

Description: Reports multiple Jest or Python test cases that mutate the same module-level
mutable collection. A local collection, a single test mutation, or ordinary
mock setup is not reported.

Create fresh state inside each test or reset shared state in explicit setup.
The rule reports a static order-dependency risk; it does not assume a specific
test runner execution order.

## Bad


```python
# File: src/domain/status.py
class Status:
    def __init__(self, value: str) -> None:
        self.value: str = value
    def normalized(self) -> str:
        trimmed = self.value.strip()
        normalized_value = trimmed.lower()
        return normalized_value
    def ready(self) -> bool:
        expected_value = 'ready'
        return self.normalized() == expected_value
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        status_value = self.normalized()
        if not normalized_fragment:
            return False
        return normalized_fragment in status_value
# File: tests/domain/test_status.py
import unittest
from src.domain.status import Status
sent_ids: list[str] = []
class TestStatus(unittest.TestCase):
    def test_sends_first_message(self) -> None:
        sent_ids.append("first")  # <- error
        status = Status("ready")
        self.assertTrue(status.ready())
    def test_sends_second_message(self) -> None:
        sent_ids.append("second")  # <- error
        status = Status("queued")
        self.assertFalse(status.ready())
```

## Good


```python
# File: src/domain/status.py
class Status:
    def __init__(self, value: str) -> None:
        self.value: str = value
    def normalized(self) -> str:
        trimmed = self.value.strip()
        normalized_value = trimmed.lower()
        return normalized_value
    def ready(self) -> bool:
        expected_value = 'ready'
        return self.normalized() == expected_value
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        status_value = self.normalized()
        if not normalized_fragment:
            return False
        return normalized_fragment in status_value
# File: tests/domain/test_status.py
import unittest
from src.domain.status import Status
class TestStatus(unittest.TestCase):
    def test_normalizes(self) -> None:
        status = Status(' READY ')
        value = status.normalized()
        self.assertEqual(value, 'ready')
    def test_classifies(self) -> None:
        status = Status('ready')
        value = status.ready()
        self.assertTrue(value)
# File: cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    print(status.normalized(), status.ready(), status.label('State'), status.contains('ead'))
```
