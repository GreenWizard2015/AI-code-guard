# `class-interface-count`

Description: A class may implement at most three interfaces or protocols; split excess roles into focused collaborators.

## Bad

```python
# File: src/protocols.py
from typing import Protocol

class ReadableContract(Protocol):
    def read(self) -> str: ...

class WritableContract(Protocol):
    def write(self, value: str) -> None: ...

class ClosableContract(Protocol):
    def close(self) -> str: ...

class FlushableContract(Protocol):
    def flush(self) -> str: ...

# File: src/data_adapter.py
from src.protocols import ReadableContract, WritableContract, ClosableContract, FlushableContract

class DataAdapter(ReadableContract, WritableContract, ClosableContract, FlushableContract):
    def __init__(self, initial_value: str) -> None:
        self._values: list[str] = [initial_value]

    def read(self) -> str:
        return " ".join(self._values)

    def write(self, value: str) -> None:
        self._values.append(value.strip())

    def close(self) -> str:
        return f"closed after {len(self.read())} characters"

    def flush(self) -> str:
        return "|".join(self._values)

    def report(self) -> None:
        self.write("saved")
        flushed_value = self.flush()
        print(f"{self.read()} | {flushed_value} | {self.close()}")
# File: cli.py
from src.data_adapter import DataAdapter

if __name__ == "__main__":
    adapter = DataAdapter("initial value")
    adapter.report()
```

## Good

```python
# File: src/protocols.py
from typing import Protocol

class TextValueContract(Protocol):
    def text(self) -> str: ...
    def empty(self) -> bool: ...
    def first_word(self) -> str: ...

class TextLengthContract(Protocol):
    def length(self) -> int: ...

class TextSearchContract(Protocol):
    def contains(self, fragment: str) -> bool: ...
# File: src/data_adapter.py
from src.protocols import TextValueContract, TextLengthContract, TextSearchContract

class DataAdapter(TextValueContract, TextLengthContract, TextSearchContract):
    """Responsibilities: _normalized text operations_."""

    def __init__(self, value: str) -> None:
        """Responsibilities: _text adapter initialization_."""
        self._value_text: str = value.strip()

    def text(self) -> str:
        """Responsibilities: _normalized text retrieval_."""
        normalized_text = self._value_text.upper()
        return " ".join(normalized_text.split())

    def empty(self) -> bool:
        return len(self.text()) == 0

    def first_word(self) -> str:
        words = self.text().split()
        if len(words) == 0:
            return ""
        return words[0]

    def length(self) -> int:
        """Responsibilities: _normalized text length_."""
        normalized_text = self._value_text.upper()
        return len(normalized_text)

    def contains(self, fragment: str) -> bool:
        """Responsibilities: _normalized text search_."""
        normalized_text = self.text()
        normalized_fragment = fragment.strip().upper()
        return normalized_fragment in normalized_text

    def summary(self) -> str:
        details = [
            self.text(),
            str(self.length()),
            str(self.contains("VALUE")),
            str(self.empty()),
            self.first_word(),
        ]
        return " | ".join(details)

    def report(self) -> None:
        """Responsibilities: _text adapter report output_."""
        print(self.summary())
# File: cli.py
from src.data_adapter import DataAdapter

if __name__ == "__main__":
    adapter = DataAdapter("initial value")
    adapter.report()
```
