# `boolean-is-name`

Description: Review boolean methods beginning with `is*`. Prefer an adjective when it reads
naturally: `isEmpty()` → `empty()`, `isReadable()` → `readable()`, and
`isNegative()` → `negative()`.

## Bad


```python
# File: src/file_entry/file_entry.py
class FileEntry:

    def __init__(self, path: str, content: str) -> None:
        self.path: str = path
        self.content: str = content

    def display_name(self) -> str:
        return self.path[self.path.rfind("/") + 1:]

    def word_count(self) -> int:
        content = self.content.strip()
        if not content:
            return 0
        return len(content.split())

    def is_empty(self) -> bool:  # <- error
        return len(self.content) == 0

    def content_summary(self) -> str:
        return f"{self.display_name()} ({self.word_count()} words)"
# File: cli.py
from src.file_entry.file_entry import FileEntry

if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello")
    print(entry.display_name(), entry.word_count(), entry.is_empty(), entry.content_summary())
```

## Good

The only change is the predicate's name; its result and all other behavior are preserved.


```python
# File: src/file_entry/file_entry.py
class FileEntry:
    """Responsibilities: _file entry state_."""

    def __init__(self, path: str, content: str) -> None:
        self.path: str = path
        self.content: str = content

    def display_name(self) -> str:
        return self.path[self.path.rfind("/") + 1:]

    def word_count(self) -> int:
        content = self.content.strip()
        if not content:
            return 0
        return len(content.split())

    def empty(self) -> bool:
        return len(self.content) == 0

    def content_summary(self) -> str:
        return f"{self.display_name()} ({self.word_count()} words)"
# File: cli.py
from src.file_entry.file_entry import FileEntry

if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello")
    print(entry.display_name(), entry.word_count(), entry.empty(), entry.content_summary())
```
