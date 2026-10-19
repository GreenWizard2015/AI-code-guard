# `getattr`

Description: Dynamic attribute lookup used for ordinary control flow hides the object's
contract. Prefer a declared field or named method for known project data.

## Bad


```python
# File: cli.py
if __name__ == "__main__":
    name = getattr(item, "name", None)
    print(name)
```

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
        return self.path[self.path.rfind("/") + 1:]

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        content = self.content.strip()
        if not content:
            return 0
        return len(content.split())

    def readable(self) -> bool:
        """Responsibilities: _content readability classification_."""
        return len(self.content.strip()) > 0

    def content_summary(self) -> str:
        """Responsibilities: _entry summary_."""
        return f"{self.file_name()} ({self.word_count()} words)"
# File: cli.py
from src.file_entry.file_entry import FileEntry

if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello world")
    print(entry.path)
    print(entry.file_name())
    print(entry.word_count())
    print(entry.readable())
    print(entry.content_summary())
```
