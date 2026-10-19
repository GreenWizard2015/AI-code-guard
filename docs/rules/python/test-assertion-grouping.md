# `test-assertion-grouping`

Description: Compare related fields of one result as a single value.

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
    def test_reports_normalized_status(self) -> None:
        status = Status(' READY ')
        result = {'value': status.normalized(), 'ready': status.ready(), 'label': status.label('State')}
        self.assertEqual(result['value'], 'ready')  # <- error
        self.assertTrue(result['ready'])
        self.assertEqual(result['label'], 'State: ready')
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
    def test_reports_normalized_status(self) -> None:
        status = Status(' READY ')
        result = {'value': status.normalized(), 'ready': status.ready(), 'label': status.label('State')}
        self.assertEqual(result, {'value': 'ready', 'ready': True, 'label': 'State: ready'})
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
