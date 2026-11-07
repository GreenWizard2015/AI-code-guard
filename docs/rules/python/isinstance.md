# `isinstance`

Description: Validate values at a boundary and avoid repeated `isinstance` checks in business logic.

## Bad

```python
# File: src/value_reader.py
class ValueReader:
    def __init__(self, value: object) -> None:
        self._value: object = value

    def value_text(self) -> str:
        if isinstance(self._value, str):
            return self._value
        if isinstance(self._value, int):
            return str(self._value)
        return "unsupported"

    def value_summary(self) -> str:
        return f"Value: {self.value_text()}"

    def report(self) -> None:
        summary = self.value_summary()
        print(summary)
# File: cli.py
from src.value_reader import ValueReader

if __name__ == "__main__":
    reader = ValueReader("validated text")
    reader.report()
```

## Good

```python
# File: src/text_value.py
class TextValue:
    def __init__(self, value: str) -> None:
        self._value: str = value

    def word_count(self) -> int:
        normalized_text = " ".join(self._value.split())
        return len(normalized_text.split())

    def character_count(self) -> int:
        normalized_text = " ".join(self._value.split())
        return len(normalized_text)

    def value_summary(self) -> str:
        normalized_text = " ".join(self._value.split())
        word_total = self.word_count()
        return f"Value: {normalized_text} ({word_total} words)"

    def report(self) -> None:
        summary = self.value_summary()
        print(f"{summary}; {self.character_count()} characters")
# File: cli.py
from src.text_value import TextValue

if __name__ == "__main__":
    value = TextValue("validated text")
    value.report()
```
