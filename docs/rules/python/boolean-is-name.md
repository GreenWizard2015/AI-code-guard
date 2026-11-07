# `boolean-is-name`

Description: Review boolean methods beginning with `is*`. Prefer an adjective when it reads
naturally: `isEmpty()` → `empty()`, `isReadable()` → `readable()`, and
`isNegative()` → `negative()`.

## Bad


```python
# File: src/file_entry/file_entry.py
class FileEntry:

    def __init__(self, path: str, content: str) -> None:
        """Responsibilities: _entry initialization_."""
        self.path: str = path
        self.content: str = content

    def display_name(self) -> str:
        """Responsibilities: _file name extraction_."""
        return self.path[self.path.rfind("/") + 1:]

    def word_count(self) -> int:
        """Responsibilities: _word counting_."""
        content = self.content.strip()
        if not content:
            return 0
        return len(content.split())

    def is_empty(self) -> bool:  # <- error
        return len(self.content) == 0

    def content_summary(self) -> str:
        return f"{self.display_name()} ({self.word_count()} words)"
    def report(self) -> None:
        print(f"{self.display_name()} {self.word_count()} {self.is_empty()} {self.content_summary()}")
# File: cli.py
from src.file_entry.file_entry import FileEntry

if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello")
    entry.report()
```

## Good

The only change is the predicate's name; its result and all other behavior are preserved.


```python
# File: src/file_entry/file_entry.py
class FileEntry:
    """Responsibilities: _file entry state_."""

    def __init__(self, path: str, content: str) -> None:
        """Responsibilities: _entry initialization_."""
        self._path: str = path
        self._content: str = content

    def display_name(self) -> str:
        """Responsibilities: _file name extraction_."""
        return self._path[self._path.rfind("/") + 1:]

    def word_count(self) -> int:
        """Responsibilities: _word counting_."""
        content = self._content.strip()
        if not content:
            return 0
        return len(content.split())

    def empty(self) -> bool:
        """Responsibilities: _empty content classification_."""
        return len(self._content) == 0

    def content_summary(self) -> str:
        """Responsibilities: _content summary formatting_."""
        return f"{self.display_name()} ({self.word_count()} words)"
    def report(self) -> None:
        """Responsibilities: _file entry output_."""
        print(f"{self.display_name()} {self.word_count()} {self.empty()} {self.content_summary()}")
# File: cli.py
from src.file_entry.file_entry import FileEntry

if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello")
    entry.report()
```
