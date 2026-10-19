# `test-max-count`

Description: Each Python `unittest.TestCase` suite may contain at most fifteen test methods. Count only `test_*` methods; setup, teardown, and fixture methods do not count. Split larger suites by cohesive behavior.

## Bad

```py
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
{% for index in range(16) %}
    def test_status_{{index}}(self) -> None:
        status = Status('value {{index}}')
        actual = status.normalized()
        self.assertEqual(actual, 'value {{index}}')
{% endfor %}
# File: cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    normalized = status.normalized()
    ready = status.ready()
    label = status.label('State')
    contains = status.contains('ead')
    print(normalized, ready, label, contains)
```

## Good

```py
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
    def test_ready(self) -> None:
        status = Status('ready')
        actual = status.ready()
        self.assertTrue(actual)
    def test_normalizes(self) -> None:
        status = Status(' READY ')
        actual = status.normalized()
        self.assertEqual(actual, 'ready')
# File: cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    normalized = status.normalized()
    ready = status.ready()
    label = status.label('State')
    contains = status.contains('ead')
    print(normalized, ready, label, contains)
```
