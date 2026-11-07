# `optional-union`

Description: See the examples below for the rule behavior.

## Bad

```python
# File: src/value_display.py
def display_value(candidate: str | None) -> str:
    if candidate is None:
        return "missing"
    return candidate

def report_value() -> None:
    print(display_value("ready"))
# File: cli.py
from src.value_display import report_value

if __name__ == "__main__":
    report_value()
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
        self._path: str = path
        self._content: str = content

    def file_name(self) -> str:
        """Responsibilities: _file label composition_."""
        separator = self._path.rfind("/")
        return self._path[separator + 1:]

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        trimmed_content = self._content.strip()
        words = trimmed_content.split()
        return len(words)

    def readable(self) -> bool:
        """Responsibilities: _content readability classification_."""
        return len(self._content.strip()) > 0

    def content_summary(self) -> str:
        """Responsibilities: _entry summary_."""
        label = self.file_name()
        words = self.word_count()
        return f"{label} ({words} words)"
    def report(self) -> None:
        """Responsibilities: _entry report_."""
        summary = self.content_summary()
        is_readable = self.readable()
        print(f"{summary}; readable={is_readable}")
# File: cli.py
from src.file_entry.file_entry import FileEntry

if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello world")
    entry.report()
```
