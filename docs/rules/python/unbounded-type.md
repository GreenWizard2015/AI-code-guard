# `unbounded-type`

Description: Do not use `any` or `unknown` in TypeScript, or `Any` in Python. The rule applies to
all type annotations recognized by the AST, including parameters, fields, return values, and
generic type positions.

Bad examples annotate values as `Any` instead of using a concrete domain type.

Fix: Replace the unbounded type with a concrete domain type or focused protocol.

## Bad

```python
# File: src/value_report.py
from typing import Any

class ValueReport:
    def __init__(self, value: Any) -> None:
        self._value: Any = value

    def normalized_value(self) -> str:
        return str(self._value)

    def report(self) -> None:
        print(self.normalized_value())
# File: cli.py
from src.value_report import ValueReport

if __name__ == "__main__":
    report = ValueReport(42)
    report.report()
```

## Good

```python
# File: src/value_text.py
class ValueText:
    def __init__(self, value: str) -> None:
        self._value: str = value

    def normalized_value(self) -> str:
        return self._value.strip().upper()

    def populated(self) -> bool:
        return len(self.normalized_value()) > 0

    def word_count(self) -> int:
        words = self.normalized_value().split()
        return len(words)

    def summary(self) -> str:
        normalized = self.normalized_value()
        word_count = self.word_count()
        return f"{normalized} ({word_count} words)"

    def report(self) -> None:
        print(f"{self.summary()} | {self.populated()}")
# File: cli.py
from src.value_text import ValueText

if __name__ == "__main__":
    value = ValueText("ready")
    value.report()
```
