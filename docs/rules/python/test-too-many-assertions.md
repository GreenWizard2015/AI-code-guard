# `test-too-many-assertions`

Description: Split a test with more than five assertions into focused tests.

## Bad


```python
# File: src/documentation/status.py
class Status:
    def __init__(self, value: str) -> None:
        self.value: str = value
    def normalized(self) -> str:
        return self.value.strip().lower()
    def ready(self) -> bool:
        return self.normalized() == 'ready'
    def label(self, prefix: str) -> str:
        return prefix.strip() + ': ' + self.normalized()
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        status_value = self.normalized()
        if not normalized_fragment:
            return False
        return normalized_fragment in status_value
# File: tests/documentation/test_status.py
import unittest
from src.documentation.status import Status
class TestStatus(unittest.TestCase):
    def test_reports_all_status_behavior(self) -> None:  # <- error
        status = Status(' READY ')
        normalized = status.normalized()
        ready = status.ready()
        label = status.label('State')
        contains = status.contains('ead')
        empty = status.contains('')
        self.assertEqual(normalized, 'ready')
        self.assertTrue(ready)
        self.assertEqual(label, 'State: ready')
        self.assertTrue(contains)
        self.assertFalse(empty)
        self.assertTrue(ready)
    def test_normalizes_another_value(self) -> None:
        normalized = Status('READY').normalized()
        self.assertEqual(normalized, 'ready')
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
        normalized_value = self.normalized()
        return normalized_value == expected
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        normalized_value = self.normalized()
        return clean_prefix + ': ' + normalized_value
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        status_value = self.normalized()
        if not normalized_fragment:
            return False
        return normalized_fragment in status_value
# File: tests/documentation/test_status.py
import unittest
from src.documentation.status import Status
class TestStatus(unittest.TestCase):
    def test_normalizes_a_value(self) -> None:
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
