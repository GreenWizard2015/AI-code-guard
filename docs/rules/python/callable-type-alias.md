# `callable-type-alias`

Description: Put every Python `Callable` signature in a named alias whose name starts with
`Callable`. Reuse that alias in fields and parameters.

## Bad

```python
# File: src/handler_reporter.py
from typing import Callable

class HandlerReporter:
    def __init__(self, handler: Callable[[str], str]) -> None:  # <- error
        self._handler: Callable[[str], str] = handler  # <- error

    def normalized_value(self) -> str:
        return self._handler(" ready ").strip().lower()

    def formatted_output(self) -> str:
        return f"Result: {self.normalized_value()}"

    def report(self) -> None:
        print(self.formatted_output())
# File: src/cli.py
from src.handler_reporter import HandlerReporter

if __name__ == "__main__":
    reporter = HandlerReporter(lambda value: value)
    reporter.report()
```

## Good

```python
# File: src/types.py
from typing import Callable, TypeAlias

CallableHandler: TypeAlias = Callable[[str], str]
# File: src/handler_reporter.py
from src.types import CallableHandler

class HandlerReporter:
    def __init__(self, handler: CallableHandler, initial_value: str) -> None:
        self._handler: CallableHandler = handler
        self._initial_value: str = initial_value

    def normalized_value(self) -> str:
        transformed_value = self._handler(self._initial_value)
        trimmed_value = transformed_value.strip()
        return trimmed_value.lower()

    def formatted_output(self) -> str:
        normalized = self.normalized_value()
        label = "Result"
        return f"{label}: {normalized}"

    def character_count(self) -> int:
        output = self.formatted_output()
        characters = list(output)
        return len(characters)

    def report(self) -> None:
        output = self.formatted_output()
        count = self.character_count()
        print(f"{output} ({count} characters)")
# File: src/cli.py
from src.handler_reporter import HandlerReporter

if __name__ == "__main__":
    reporter = HandlerReporter(lambda value: value, " ready ")
    reporter.report()
```
