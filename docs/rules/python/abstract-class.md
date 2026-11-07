# `abstract-class`

Description: Project Python contracts must use structural `Protocol` types or interfaces instead
of abstract base classes.

```python
from abc import ABC, abstractmethod

class UserStore(ABC):  # violation
    @abstractmethod
    def load(self):
        ...
```


Fix: Replace the abstract class with a focused `Protocol` and move implementation logic into
a normal class. The rule covers bases named `ABC` or `ABCMeta` and classes declaring
`@abstractmethod`.

## Bad

```python
# File: src/user_store.py
from abc import ABC, abstractmethod

class UserStore(ABC):  # <- error
    def __init__(self, user_name: str) -> None:
        self._user_name: str = user_name

    @abstractmethod
    def fetch_user(self, user_id: str) -> str:
        ...

class MemoryUserStore(UserStore):
    def fetch_user(self, user_id: str) -> str:
        return f"{user_id}: {self._user_name}"

    def user_count(self) -> int:
        return 1

    def summary(self) -> str:
        return f"Stored users: {self.user_count()}"

    def report(self) -> None:
        print(f"{self.fetch_user('u-1')} | {self.summary()}")
# File: cli.py
from src.user_store import MemoryUserStore

if __name__ == "__main__":
    store = MemoryUserStore("Ada")
    store.report()
```

## Good

```python
# File: src/protocols.py
from typing import Protocol

class ReaderContract(Protocol):
    """Responsibilities: _content reading contract_."""

    def content_text(self) -> str: ...
    def word_count(self) -> int: ...
    def blank(self) -> bool: ...
# File: src/content_reader.py
from src.protocols import ReaderContract

class ContentReader(ReaderContract):
    """Responsibilities: _content reading_."""

    def __init__(self, content: str) -> None:
        """Responsibilities: _reader initialization_."""
        self._content: str = content

    def content_text(self) -> str:
        """Responsibilities: _content access_."""
        return " ".join(self._content.split())

    def word_count(self) -> int:
        """Responsibilities: _content word counting_."""
        return len(self._content.split())

    def blank(self) -> bool:
        """Responsibilities: _empty content classification_."""
        return len(self._content.strip()) == 0

    def report(self) -> None:
        """Responsibilities: _reader report output_."""
        content = self.content_text()
        words = self.word_count()
        blank = self.blank()
        print(f"{words} words, blank={blank}: {content}")
# File: cli.py
from src.content_reader import ContentReader

if __name__ == "__main__":
    reader = ContentReader("ready to read")
    reader.report()
```
