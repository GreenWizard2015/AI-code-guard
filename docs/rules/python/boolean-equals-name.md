# `boolean-equals-name`

Description: Review boolean `equals()` methods. When the language protocol permits it, a
property-shaped name such as `equal_to()` better expresses the comparison.
Do not rename a required language equality protocol mechanically.

## Bad


```python
# File: src/file_entry/file_entry.py
class FileEntry:

    def __init__(self, path: str, content: str) -> None:
        self.path: str = path
        self.content: str = content

    def file_name(self) -> str:
        separator = self.path.rfind("/")
        return self.path[separator + 1:]

    def word_count(self) -> int:
        trimmed_content = self.content.strip()
        words = trimmed_content.split()
        return len(words)

    def equals(self, other_content: str) -> bool:
        normalized_content = " ".join(self.content.split())
        return normalized_content == other_content
# File: cli.py
from file_entry.file_entry import FileEntry
if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello")
    label = entry.file_name()
    words = entry.word_count()
    print(label, words, entry.equals("hello world"))
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
        separator = self.path.rfind("/")
        return self.path[separator + 1:]

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        trimmed_content = self.content.strip()
        words = trimmed_content.split()
        return len(words)

    def equal_to(self, other_content: str) -> bool:
        """Responsibilities: _content equivalence_."""
        normalized_content = " ".join(self.content.split())
        return normalized_content == other_content
# File: cli.py
from file_entry.file_entry import FileEntry
if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello")
    label = entry.file_name()
    words = entry.word_count()
    print(label, words, entry.equal_to("hello world"))
```
