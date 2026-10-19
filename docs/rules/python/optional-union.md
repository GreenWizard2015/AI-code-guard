# `optional-union`

Description: See the examples below for the rule behavior.

## Bad

```python
# File: functions.py
def display_value(value: str | None) -> str:
    if value is None:
        return "missing"
    return value
# File: cli.py
from functions import display_value

if __name__ == "__main__":
    print(display_value("ready"))
```

Use a required value object or explicit state contract when absence has domain meaning; do not
replace the union with another nullable annotation.

## Good

```python
# File: src/file_entry/file_entry.py
class FileEntry:
    """Responsibilities: _file entry state_."""

    def __init__(self, path: str, content: str) -> None:
        """Responsibilities: _file entry initialization_."""
        self.path: str = path
        self.content: str = content

    def file_name(self) -> str:
        """Responsibilities: _file label composition_."""
        separator = self.path.rfind("/")
        return self.path[separator + 1:]

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        trimmed_content = self.content.strip()
        words = trimmed_content.split()
        return len(words)

    def readable(self) -> bool:
        """Responsibilities: _content readability classification_."""
        return len(self.content.strip()) > 0

    def content_summary(self) -> str:
        """Responsibilities: _entry summary_."""
        label = self.file_name()
        words = self.word_count()
        return f"{label} ({words} words)"
# File: cli.py
from src.file_entry.file_entry import FileEntry

if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello world")
    print(entry.file_name())
    print(entry.word_count())
    print(entry.readable())
    print(entry.content_summary())
```
