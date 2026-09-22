# `python-test-assert`

**Purpose:** Python tests that import `unittest` must verify behavior with direct `self.assert*` assertions.

```py
import unittest


class TestService(unittest.TestCase):
    def test_result(self):
        self.assertEqual(load_value(), expected_value)
```

**Fix:** Add at least one `self.assert*` call directly to every `test_*` method. Keep all `self.assert*` calls together at the end of the method at test level; do not put them inside helpers, lambdas, conditions, or other nested blocks.

Do not use Python's bare `assert` statement in test files. Use an explicit `self.assert*` method instead.

Do not use a test only for setup, logging, or side effects.
