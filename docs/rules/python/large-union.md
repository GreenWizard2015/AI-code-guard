# `large-union`

Description: Too many alternatives make a value contract ambiguous.


Python annotations with the same number of alternatives are also reported:

```python
def read(value: A | B | C | D) -> A:
    return value
```


Fix: Introduce a focused discriminated type or protocol.

## Bad


```python
# File: src/types.py
Result = str | int | bool | float

# File: src/result_reporter.py
from src.types import Result

class ResultReporter:
    def __init__(self, prefix: str, value: str | int | bool | float) -> None:
        self._prefix: str = prefix
        self._value: Result = value
    def format_result(self) -> str:
        raw_value = str(self._value).strip()
        if not raw_value:
            return ""
        words = raw_value.split()
        normalized_words: list[str] = []
        for word in words:
            if word:
                normalized_words.append(word)
        return " ".join(normalized_words)
    def empty(self) -> bool:
        formatted = self.format_result()
        if not formatted:
            return True
        return len(formatted.strip()) == 0
    def report(self) -> None:
        if self.empty():
            return
        formatted = self.format_result()
        output = f"{self._prefix.strip()}: {formatted}"
        print(output)

# File: cli.py
from src.result_reporter import ResultReporter

if __name__ == "__main__":
    reporter = ResultReporter("Result", "first")
    reporter.report()
```

## Good


```python
# File: src/types.py
Item = str

# File: src/result_reporter.py
from src.types import Item

class ResultReporter:
    def __init__(self, prefix: str, value: Item) -> None:
        self._prefix: str = prefix
        self._value: Item = value
    def format_result(self) -> str:
        raw_value = self._value.strip()
        if not raw_value:
            return ""
        words = raw_value.split()
        normalized_words: list[str] = []
        for word in words:
            if word:
                normalized_words.append(word)
        return " ".join(normalized_words)
    def empty(self) -> bool:
        formatted = self.format_result()
        if not formatted:
            return True
        return len(formatted.strip()) == 0
    def report(self) -> None:
        if self.empty():
            return
        formatted = self.format_result()
        output = f"{self._prefix.strip()}: {formatted}"
        print(output)

# File: cli.py
from src.result_reporter import ResultReporter
from src.types import Item

if __name__ == "__main__":
    item: Item = "one"
    reporter = ResultReporter("Item", item)
    reporter.report()
```
