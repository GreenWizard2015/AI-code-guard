# `inline-assertion-object-literals`

Description: Inline object literals in equality assertions when temporary names exist only for the comparison.

## Bad

```python
# File: src/domain/status.py
class Status:
    def __init__(self, value: str) -> None:
        self._value: str = value
        self._cache: dict[str, str] = {}
    def normalized(self) -> str:
        cached = self._cache.get(self._value)
        if cached is not None:
            return cached
        normalized = self._value.strip().lower()
        self._cache[self._value] = normalized
        return normalized
    def ready(self) -> bool:
        return self.normalized() == "ready"
    def label(self) -> str:
        return "Status: " + self.normalized()
    def contains(self, fragment: str) -> bool:
        return fragment in self.normalized()
    def report(self) -> None:
        print(self.label(), self.ready(), self.contains("ready"))
# File: tests/domain/status_test.py
import unittest
from src.domain.status import Status

class StatusTests(unittest.TestCase):
    def test_normalizes_status(self) -> None:
        actual = {"status": Status(" READY ").normalized(), "ready": Status(" READY ").ready()}
        expected = {"status": "ready", "ready": True}
        self.assertEqual(actual, expected)

    def test_labels_status(self) -> None:
        actual = {"label": Status("ready").label(), "normalized": Status("ready").normalized()}
        expected = {"label": "Status: ready", "normalized": "ready"}
        self.assertEqual(actual, expected)
# File: cli.py
from src.domain.status import Status

if __name__ == "__main__":
    status = Status(" READY ")
    status.report()
```

## Good

```python
# File: src/domain/status.py
class Status:
    def __init__(self, value: str) -> None:
        self._value: str = value
        self._cache: dict[str, str] = {}
    def normalized(self) -> str:
        cached = self._cache.get(self._value)
        if cached is not None:
            return cached
        normalized = self._value.strip().lower()
        self._cache[self._value] = normalized
        return normalized
    def ready(self) -> bool:
        return self.normalized() == "ready"
    def label(self) -> str:
        return "Status: " + self.normalized()
    def contains(self, fragment: str) -> bool:
        return fragment in self.normalized()
    def report(self) -> None:
        print(self.label(), self.ready(), self.contains("ready"))
# File: tests/domain/status_test.py
import unittest
from src.domain.status import Status

class StatusTests(unittest.TestCase):
    def test_normalizes_status(self) -> None:
        status = Status(" READY ")
        result = {"status": status.normalized(), "ready": status.ready(), "label": status.label()}
        self.assertEqual(result, {"status": "ready", "ready": True, "label": "Status: ready"})

    def test_labels_status(self) -> None:
        status = Status("ready")
        result = {"contains": status.contains("ready"), "label": status.label(), "normalized": status.normalized()}
        self.assertEqual(result, {"contains": True, "label": "Status: ready", "normalized": "ready"})
# File: cli.py
from src.domain.status import Status

if __name__ == "__main__":
    status = Status(" READY ")
    status.report()
```
