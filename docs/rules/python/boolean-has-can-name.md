# `boolean-has-can-name`

Description: Prefer a natural boolean name such as `readable()` when it expresses the same
contract as `can_read()`. Do not invent awkward adjectives.

## Bad


```python
# File: src/content_record.py
class ContentRecord:
    def __init__(self, content: str) -> None:
        self.content: str = content
    def word_count(self) -> int:
        normalized = self.content.strip()
        if not normalized:
            return 0
        words = normalized.split()
        return len(words)
    def line_count(self) -> int:
        return max(1, len(self.content.splitlines()))
    def can_read(self) -> bool:  # <- error
        return len(self.content.strip()) > 0
    def summary(self) -> str:
        words = self.word_count()
        return f"{words} words in {self.line_count()} lines"
    def report(self) -> None:
        print(f"{self.can_read()} {self.summary()}")
# File: cli.py
from src.content_record import ContentRecord

if __name__ == "__main__":
    record = ContentRecord("hello world")
    record.report()
```

## Good


```python
# File: src/content_record.py
class ContentRecord:
    """Responsibilities: _file readability_."""
    def __init__(self, content: str) -> None:
        """Responsibilities: _entry initialization_."""
        self._content: str = content
    def word_count(self) -> int:
        """Responsibilities: _word counting_."""
        normalized = self._content.strip()
        if not normalized:
            return 0
        words = normalized.split()
        return len(words)
    def line_count(self) -> int:
        """Responsibilities: _line counting_."""
        return max(1, len(self._content.splitlines()))
    def readable(self) -> bool:
        """Responsibilities: _readability check_."""
        return len(self._content.strip()) > 0
    def summary(self) -> str:
        """Responsibilities: _content summary_."""
        words = self.word_count()
        return f"{words} words in {self.line_count()} lines"
    def report(self) -> None:
        """Responsibilities: _content report output_."""
        print(f"{self.readable()} {self.summary()}")
# File: cli.py
from src.content_record import ContentRecord

if __name__ == "__main__":
    record = ContentRecord("hello world")
    record.report()
```
