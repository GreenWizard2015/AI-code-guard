# `test-max-size`

Description: Keep each unittest method focused on one behavior and within the callable size limit. Count the method plus logical body statements; blank lines and comments do not count.

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
    def test_many_values(self) -> None:
        status = Status('ready')
        value_0 = 0
        value_1 = 1
        value_2 = 2
        value_3 = 3
        value_4 = 4
        value_5 = 5
        value_6 = 6
        value_7 = 7
        value_8 = 8
        value_9 = 9
        value_10 = 10
        value_11 = 11
        value_12 = 12
        value_13 = 13
        value_14 = 14
        value_15 = 15
        self.assertTrue(status.ready())
        self.assertEqual(value_15, 15) # <- error
# File: cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    print(status.normalized(), status.ready(), status.label('State'), status.contains('ead'))
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
        status = Status("ready")
        self.assertTrue(status.is_ready())

    def test_normalizes(self) -> None:
        status = Status(' READY ')
        actual = status.normalized()
        self.assertEqual(actual, 'ready')
# File: cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    print(status.normalized(), status.ready(), status.label('State'), status.contains('ead'))
```
