# test-time-dependency

Description: Reports direct real-time, sleep, or unseeded-random calls in TypeScript Jest
tests and Python `test_*` functions. Inject a clock or deterministic random
source for unit tests. Integration tests that intentionally exercise a real
clock should be kept at an explicit integration boundary.

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
        normalized_value = self.normalized()
        expected_value = 'ready'
        return normalized_value == expected_value
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        status_value = self.normalized()
        if not normalized_fragment:
            return False
        return normalized_fragment in status_value
    def report(self) -> None:
        print(self.normalized(), self.ready(), self.label('State'), self.contains('ead'))
# File: tests/domain/test_status.py
import unittest
from datetime import datetime
from src.domain.status import Status
class TestStatus(unittest.TestCase):
    def test_uses_current_time(self) -> None:
        current_time = datetime.now()  # <- error
        current_text = str(current_time)
        self.assertEqual(Status(current_text).normalized(), current_text.lower())
    def test_ready(self) -> None: self.assertTrue(Status("ready").ready())
# File: src/cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    status.report()
```

## Good


```python
# File: src/domain/status.py
class Status:
    def __init__(self, value: str) -> None:
        self._value: str = value
    def normalized(self) -> str:
        trimmed = self._value.strip()
        normalized_value = trimmed.lower()
        return normalized_value
    def ready(self) -> bool:
        normalized_value = self.normalized()
        expected_value = 'ready'
        return normalized_value == expected_value
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        status_value = self.normalized()
        if not normalized_fragment:
            return False
        return normalized_fragment in status_value
    def report(self) -> None:
        print(self.normalized(), self.ready(), self.label('State'), self.contains('ead'))
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
# File: src/cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    status.report()
```
