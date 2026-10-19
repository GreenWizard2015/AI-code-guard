# `boolean-exists-name`

Description: Prefer `present()` over boolean `exists()` when it expresses the same contract.

## Bad


```python
# File: src/file_entry/file_entry.py
class FileEntry:

    def __init__(self, path: str, content: str) -> None:
        self.path: str = path
        self.content: str = content

    def file_name(self) -> str:
        return self.path[self.path.rfind("/") + 1:]

    def word_count(self) -> int:
        return len(self.content.split())

    def exists(self) -> bool:  # <- error
        return len(self.content) > 0

    def content_summary(self) -> str:
        label = self.file_name()
        words = self.word_count()
        return f"{label} ({words} words)"
# File: cli.py
from file_entry.file_entry import FileEntry
if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello world")
    label = entry.file_name()
    words = entry.word_count()
    exists = entry.exists()
    print(label, words, exists, entry.content_summary())
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
        return len(self.content.split())

    def present(self) -> bool:
        """Responsibilities: _content presence classification_."""
        return len(self.content) > 0

    def content_summary(self) -> str:
        """Responsibilities: _entry summary_."""
        label = self.file_name()
        words = self.word_count()
        return f"{label} ({words} words)"
# File: cli.py
from file_entry.file_entry import FileEntry
if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello world")
    label = entry.file_name()
    words = entry.word_count()
    present = entry.present()
    print(label, words, present, entry.content_summary())
```
