# `test-targets`

Description: Anchor a test to an imported production class or function whose module path matches the
test. Check imports in usage order instead of rejecting the test at the first path mismatch. Type-only,
side-effect, test-support, external, and standard-library imports do not qualify.

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
    def report(self) -> None:
        normalized = self.normalized()
        readiness = self.ready()
        label = self.label('State')
        contains = self.contains('ead')
        print(normalized, readiness, label, contains)
# File: tests/services/test_status.py
import unittest
from src.domain.status import Status
class TestStatus(unittest.TestCase):
    def test_normalizes(self) -> None:  # <- error
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
Rank classes/functions by references outside import declarations; source import order breaks ties.
Resolve imports and check each production target until its module path matches the test. Ignore
`tests/` and `__tests__/`, support, external, standard-library, type-only, side-effect, module, and
constant imports.

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
        readiness = self.ready()
        label = self.label('State')
        contains = self.contains('ead')
        print(normalized, readiness, label, contains)
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
