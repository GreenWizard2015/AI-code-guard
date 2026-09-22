# `python-test-class-inheritance`

Every Python test class must inherit from exactly one fully qualified `unittest.TestCase`.

```py
import unittest

class TestService(unittest.TestCase):
    def test_result(self):
        ...
```

A missing base, a pytest base class, an unqualified project helper, or multiple inheritance is not accepted.
