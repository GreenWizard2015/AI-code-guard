# `python-test-subtest`

Do not use `with self.subTest(...)` or `async with self.subTest(...)` in Python tests. Parameterized cases must use the `parameterized` package instead:

```py
from parameterized import parameterized


class TestParser(unittest.TestCase):
    @parameterized.expand([
        ("empty", "", None),
        ("value", "value", "value"),
    ])
    def test_parse(self, _name, source, expected):
        self.assertEqual(parse(source), expected)
```

**Fix:** replace the `subTest` block with `@parameterized.expand(...)` and one test method that verifies the real result for each case.
