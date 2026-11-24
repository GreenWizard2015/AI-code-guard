# `test-type-check`

Description: Tests must prove behavior, not identify runtime types. A type is not behavior: knowing that a value is a `Widget` does not show what the program did with it. Assert the returned value, state change, emitted event, or other observable effect instead.

## Bad

```python
# File: src/success.py
class Success:
    def __init__(self, value: int) -> None:
        self._value: int = value
    def value(self) -> int:
        return self._value
# File: src/type_check.py
from src.success import Success

class TypeCheck:
    def run(self) -> Success:
        return Success(3)
    def doubled(self) -> int:
        return self.run().value() * 2
    def description(self) -> str:
        return "value=" + str(self.run().value())
    def positive(self) -> bool:
        return self.run().value() > 0
    def report(self) -> None:
        print(self.description(), self.doubled(), self.positive())
# File: tests/type_check_test.py
import unittest
from src.success import Success
from src.type_check import TypeCheck

class TypeCheckTests(unittest.TestCase):
    def test_returns_success(self) -> None:
        self.assertIsInstance(TypeCheck().run(), Success)

    def test_doubles_the_value(self) -> None:
        self.assertEqual(TypeCheck().doubled(), 6)
# File: cli.py
from src.type_check import TypeCheck

if __name__ == "__main__":
    TypeCheck().report()
```

```python
# File: src/success.py
class Success:
    def __init__(self, value: int) -> None:
        self._value: int = value
    def value(self) -> int:
        return self._value
# File: src/type_check.py
from src.success import Success

class TypeCheck:
    def run(self) -> Success:
        return Success(3)
    def doubled(self) -> int:
        return self.run().value() * 2
    def description(self) -> str:
        return "value=" + str(self.run().value())
    def positive(self) -> bool:
        return self.run().value() > 0
    def report(self) -> None:
        print(self.description(), self.doubled(), self.positive())
# File: tests/type_check_test.py
import unittest
from src.type_check import TypeCheck

class TypeCheckTests(unittest.TestCase):
    def test_returns_an_object(self) -> None:
        self.assertTrue(isinstance(TypeCheck().run(), object))

    def test_doubles_the_value(self) -> None:
        self.assertEqual(TypeCheck().doubled(), 6)
# File: cli.py
from src.type_check import TypeCheck

if __name__ == "__main__":
    TypeCheck().report()
```

## Good

```python
# File: src/domain/type_check.py
class TypeCheck:
    def __init__(self, value: int) -> None:
        self._value: int = value
        self._cache: dict[str, int] = {}
    def run(self) -> int:
        cached = self._cache.get("run")
        if cached is not None:
            return cached
        result = max(0, self._value)
        self._cache["run"] = result
        return result
    def doubled(self) -> int:
        return self.run() * 2
    def description(self) -> str:
        return "value=" + str(self.run())
    def positive(self) -> bool:
        return self.run() > 0
    def report(self) -> None:
        print(self.description(), self.doubled(), self.positive())
# File: tests/domain/type_check_test.py
import unittest
from src.domain.type_check import TypeCheck

class TypeCheckTests(unittest.TestCase):
    def test_returns_the_value(self) -> None:
        service = TypeCheck(3)
        result = {"value": service.run(), "doubled": service.doubled()}
        self.assertEqual(result, {"value": 3, "doubled": 6})

    def test_doubles_the_value(self) -> None:
        service = TypeCheck(4)
        result = {"doubled": service.doubled(), "positive": service.positive()}
        self.assertEqual(result, {"doubled": 8, "positive": True})
# File: cli.py
from src.domain.type_check import TypeCheck

if __name__ == "__main__":
    service = TypeCheck(3)
    service.report()
```

The rule reports runtime type probes such as `isinstance`, `issubclass`, `callable`, one-argument `type(...)`, type comparisons, class-pattern matches, and unittest instance or subclass assertions. It does not prohibit static annotations.
