# test-file-location

Description: Put tests below the project-root `tests/` or `__tests__/` directory, not beside production code.

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
    def report(self) -> None:
        normalized = self.normalized()
        label = self.label('State')
        if self.ready():
            print(normalized, label)
            return
        print('not ready', label)
# File: src/domain/test_status.py
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
    def report(self) -> None:
        normalized = self.normalized()
        label = self.label('State')
        contains = self.contains('ead')
        if self.ready():
            print(normalized, label, contains)
            return
        print('not ready', label)
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
        status.report()
        self.assertTrue(value)
# File: cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    status.report()
```
