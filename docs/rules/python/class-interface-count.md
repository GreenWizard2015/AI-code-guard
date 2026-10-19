# `class-interface-count`

Description: One implementation class may implement at most three interfaces or protocols.
When a class needs more contracts, split it into focused adapters or
collaborators instead of keeping unrelated roles on one class.

## Bad


```python
from typing import Protocol

class ReadableContract(Protocol):
    def read(self) -> str: ...

class WritableContract(Protocol):
    def write(self, value: str) -> None: ...

class ClosableContract(Protocol):
    def close(self) -> None: ...

class FlushableContract(Protocol):
    def flush(self) -> None: ...

class DataAdapter(ReadableContract, WritableContract, ClosableContract, FlushableContract):
    def read(self) -> str: return "value"
    def write(self, value: str) -> None: return None
    def close(self) -> None: return None
    def flush(self) -> None: return None
```

## Good


```python
# File: src/protocols.py
from typing import Protocol

class TextValueContract(Protocol):
    def text(self) -> str: ...

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
        self.value_text: str = value.strip()

    def text(self) -> str:
        """Responsibilities: _normalized text retrieval_."""
        normalized_text = self.value_text.upper()
        return " ".join(normalized_text.split())

    def length(self) -> int:
        """Responsibilities: _normalized text length_."""
        normalized_text = self.value_text.upper()
        return len(normalized_text)

    def contains(self, fragment: str) -> bool:
        """Responsibilities: _normalized text search_."""
        normalized_text = self.text()
        normalized_fragment = fragment.strip().upper()
        return normalized_fragment in normalized_text
# File: cli.py
from src.data_adapter import DataAdapter

if __name__ == "__main__":
    adapter = DataAdapter("initial value")
    print(adapter.text())
    print(adapter.length())
    print(adapter.contains("value"))
```
