# `test-type-check`

Description: Tests must prove behavior, not identify runtime types. A type is not behavior: knowing that a value is a `Widget` does not show what the program did with it. Assert the returned value, state change, emitted event, or other observable effect instead.

## Bad

```python
class ServiceTests(unittest.TestCase):
    def test_result(self) -> None:
        result = Service().run()
        self.assertIsInstance(result, Success)
```

```python
class ServiceTests(unittest.TestCase):
    def test_result(self) -> None:
        result = Service().run()
        self.assertTrue(isinstance(result, Success))
        self.assertEqual(result.value, 3)
```

## Good

```python
class ServiceTests(unittest.TestCase):
    def test_result(self) -> None:
        result = Service().run()
        self.assertEqual(result.value, 3)
```

The rule reports runtime type probes such as `isinstance`, `issubclass`, `callable`, one-argument `type(...)`, type comparisons, class-pattern matches, and unittest instance or subclass assertions. It does not prohibit static annotations.
