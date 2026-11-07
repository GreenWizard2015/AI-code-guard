# `broad-except`

Description: Broad catches hide unrelated programming failures.

TypeScript catches without a specific error boundary are also reported.

Fix: Catch only the expected exception at the I/O, network, process, or JSON boundary.

## Bad

```python
# File: src/numeric_label.py
class NumericLabel:
    def __init__(self, raw_value: str) -> None:
        self._raw_value: str = raw_value

    def normalized_value(self) -> str:
        try:
            return str(int(self._raw_value))
        except Exception:
            return "unavailable"

    def available(self) -> bool:
        return len(self.normalized_value()) > 0

    def value_width(self) -> int:
        return len(self.normalized_value())

    def summary(self) -> str:
        normalized = self.normalized_value()
        status = "available" if self.available() else "unavailable"
        width = self.value_width()
        return f"{normalized} | {status} | {width} characters"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.numeric_label import NumericLabel

if __name__ == "__main__":
    label = NumericLabel("not-a-number")
    label.report()
```

## Good

```python
# File: src/numeric_label.py
class NumericLabel:
    def __init__(self, raw_value: str) -> None:
        self._raw_value: str = raw_value

    def normalized_value(self) -> str:
        try:
            return str(int(self._raw_value))
        except ValueError:
            return "invalid number"

    def available(self) -> bool:
        return len(self.normalized_value()) > 0

    def value_width(self) -> int:
        return len(self.normalized_value())

    def summary(self) -> str:
        normalized = self.normalized_value()
        status = "available" if self.available() else "unavailable"
        width = self.value_width()
        return f"{normalized} | {status} | {width} characters"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.numeric_label import NumericLabel

if __name__ == "__main__":
    label = NumericLabel("not-a-number")
    label.report()
```
