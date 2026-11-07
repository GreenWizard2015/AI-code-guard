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

    def _content_label(self) -> str:
        return f"{self.name}: {self.content}"

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

    def summary(self) -> str:
        label = self._content_label()
        count = self.word_count()
        return f"{label} ({count} words)"

    def report(self) -> None:
        summary = self.summary()
        count = self.word_count()
        output = f"{summary}\nWord count: {count}"
        print(output)

# File: cli.py
from src.content_record import ContentRecord
if __name__ == "__main__":
    record = ContentRecord("notes.txt", "ready value")
    record.report()
```

## Good


```python
# File: src/content_record.py
class ContentRecord:
    """Responsibilities: _content record state_."""

    def __init__(self, name: str, content: str) -> None:
        """Responsibilities: _record initialization_."""
        self._name: str = name
        self._content: str = content

    def normalized_content(self) -> str:
        """Responsibilities: _content normalization_."""
        words = self._content.split()
        normalized = " ".join(words)
        return normalized

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        normalized = self.normalized_content()
        words = normalized.split()
        return len(words)

    def content_label(self) -> str:
        """Responsibilities: _content label_."""
        clean_name = self._name.strip()
        clean_content = self._content.strip()
        label = f"{clean_name}: {clean_content}"
        return label

    def summary(self) -> str:
        """Responsibilities: _record summary_."""
        label = self.content_label()
        count = self.word_count()
        return f"{label} ({count} words)"

    def report(self) -> None:
        """Responsibilities: _record report output_."""
        summary = self.summary()
        count = self.word_count()
        output = f"{summary}\nWord count: {count}"
        print(output)
# File: cli.py
from src.content_record import ContentRecord
if __name__ == "__main__":
    record = ContentRecord("notes.txt", "ready value")
    record.report()
```
