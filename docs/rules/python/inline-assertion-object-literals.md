# `inline-assertion-object-literals`

Description: Inline object literals in equality assertions when temporary names exist only for the comparison.

## Bad

```python
# File: tests/status_test.py
import unittest

class StatusTests(unittest.TestCase):
    def test_status(self) -> None:
        actual = {"status": "ready"}
        expected = {"status": "ready"}
        self.assertEqual(actual, expected)
```

## Good

```python
# File: tests/status_test.py
import unittest

class StatusTests(unittest.TestCase):
    def test_status(self) -> None:
        self.assertEqual({"status": "ready"}, {"status": "ready"})
```
