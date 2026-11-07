# `mixed-arithmetic-precedence`

Description: Split an arithmetic expression or add parentheses when it mixes `+`, `-`, `*`, `/`, `%`, `//`, and `**` in one ungrouped expression. Parentheses around a larger expression do not hide a mixed expression inside that group.

## Bad

```python
# File: src/arithmetic_report.py
class ArithmeticReport:
    def __init__(self, first: float, second: float, third: float) -> None:
        self._first: float = first
        self._second: float = second
        self._third: float = third

    def total(self) -> float:
        return self._first + self._second / self._third  # <- error

    def scaled_total(self) -> float:
        return self._first + self._second * self._third  # <- error

    def summary(self) -> str:
        total = self.total()
        scaled = self.scaled_total()
        return f"Total {total}; scaled {scaled}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.arithmetic_report import ArithmeticReport

if __name__ == "__main__":
    report = ArithmeticReport(12, 3, 2)
    report.report()
```

## Good

```python
# File: src/arithmetic_report.py
class ArithmeticReport:
    def __init__(self, first: float, second: float, third: float) -> None:
        self._first: float = first
        self._second: float = second
        self._third: float = third

    def total(self) -> float:
        return self._first + (self._second / self._third)

    def scaled_total(self) -> float:
        return self._first + (self._second * self._third)

    def summary(self) -> str:
        total = self.total()
        scaled = self.scaled_total()
        return f"Total {total}; scaled {scaled}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.arithmetic_report import ArithmeticReport

if __name__ == "__main__":
    report = ArithmeticReport(12, 3, 2)
    report.report()
```
