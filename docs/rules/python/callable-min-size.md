# `callable-min-size`

Description: Detect functions and methods whose implementation is too small to own meaningful
behavior.


Fix: Inline a short forwarding operation, move behavior to its caller, or replace the indirection
with a focused module function. Do not add padding or wrappers only to satisfy the rule.

Size averages callable-body lines and executable SLOC, excluding signatures and Python docstrings.
The separate 100-significant-character limit ignores whitespace; do not pad code to satisfy either.

## Bad


```python
# File: src/content_record.py
class ContentRecord:

    def __init__(self, name: str, content: str) -> None:
        self.name: str = name
        self.content: str = content

    def normalized_content(self) -> str:
        words = self.content.split()
        normalized = " ".join(words)
        return normalized

    def word_count(self) -> int:
        normalized = self.normalized_content()
        words = normalized.split()
        return len(words)

    def _content_label(self) -> str:
        return f"{self.name}: {self.content}"

    def summary(self) -> str:
        label = self._content_label()
        count = self.word_count()
        return f"{label} ({count} words)"
# File: cli.py
from content_record import ContentRecord
if __name__ == "__main__":
    record = ContentRecord("notes.txt", "ready value")
    count = record.word_count()
    print(count, record.summary())
```

## Good


```python
# File: src/content_record.py
class ContentRecord:
    """Responsibilities: _content record state_."""

    def __init__(self, name: str, content: str) -> None:
        """Responsibilities: _record initialization_."""
        self.name: str = name
        self.content: str = content

    def normalized_content(self) -> str:
        """Responsibilities: _content normalization_."""
        words = self.content.split()
        normalized = " ".join(words)
        return normalized

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        normalized = self.normalized_content()
        words = normalized.split()
        return len(words)

    def content_label(self) -> str:
        """Responsibilities: _content label_."""
        return f"{self.name}: {self.content}"

    def summary(self) -> str:
        """Responsibilities: _record summary_."""
        label = self.content_label()
        count = self.word_count()
        return f"{label} ({count} words)"
# File: cli.py
from content_record import ContentRecord
if __name__ == "__main__":
    record = ContentRecord("notes.txt", "ready value")
    label = record.content_label()
    count = record.word_count()
    print(label, count, record.summary())
```
