# `test-duplicate-setup`

Description: Remove repeated identical setup statements from one test.

## Bad


```python
# File: src/documentation/status.py
class Status:
    def __init__(self, value: str) -> None:
        self.value: str = value
    def normalized(self) -> str:
        trimmed = self.value.strip()
        normalized_value = trimmed.lower()
        return normalized_value
    def ready(self) -> bool:
        expected = 'ready'
        return self.normalized() == expected
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()
    def contains(self, fragment: str) -> bool:
        value = fragment.strip().lower()
        normalized = self.normalized()
        if not value:
            return False
        return value in normalized
# File: tests/documentation/test_status.py
import unittest
from src.documentation.status import Status
class TestStatus(unittest.TestCase):
    def test_normalizes_an_input(self) -> None:
        status = Status(' READY ')
        status = Status(' READY ')  # <- error
        normalized = status.normalized()
        self.assertEqual(normalized, 'ready')
    def test_classifies_readiness(self) -> None:
        status = Status('ready')
        ready = status.ready()
        self.assertTrue(ready)
# File: cli.py
from src.documentation.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    output = [status.normalized(), status.ready(), status.label('State'), status.contains('ead')]
    print(output)
```

## Good


```python
# File: src/documentation/status.py
class Status:
    def __init__(self, value: str) -> None:
        self.value: str = value
    def normalized(self) -> str:
        trimmed = self.value.strip()
        normalized_value = trimmed.lower()
        return normalized_value
    def ready(self) -> bool:
        expected = 'ready'
        return self.normalized() == expected
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()
    def contains(self, fragment: str) -> bool:
        value = fragment.strip().lower()
        normalized = self.normalized()
        if not value:
            return False
        return value in normalized
# File: tests/documentation/test_status.py
import unittest
from src.documentation.status import Status
class TestStatus(unittest.TestCase):
    def test_normalizes_an_input(self) -> None:
        status = Status(' READY ')
        normalized = status.normalized()
        self.assertEqual(normalized, 'ready')
    def test_classifies_readiness(self) -> None:
        status = Status('ready')
        ready = status.ready()
        self.assertTrue(ready)
# File: cli.py
from src.documentation.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    output = [status.normalized(), status.ready(), status.label('State'), status.contains('ead')]
    print(output)
```
