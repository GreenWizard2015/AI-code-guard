# `getattr`

Description: Dynamic attribute lookup used for ordinary control flow hides the object's
contract. Prefer a declared field or named method for known project data.

## Bad


```python
# File: src/item_record.py
class ItemRecord:
    def __init__(self, name: str, category: str) -> None:
        self._name: str = name
        self._category: str = category

    def label(self) -> str:
        return f"{self._name}: {self._category}"

    def name_summary(self) -> str:
        name_words = self._name.split()
        return " ".join(name_words).upper()
# File: src/item_reporter.py
from src.item_record import ItemRecord

class ItemReporter:
    def _dynamic_name(self) -> str:
        return getattr(self._item, "name", "unknown")  # <- error

    def __init__(self, name: str, category: str) -> None:
        self._item: ItemRecord = ItemRecord(name, category)

    def report(self) -> None:
        print(f"{self._item.label()} ({self._item.name_summary()})")
# File: cli.py
from src.item_reporter import ItemReporter

if __name__ == "__main__":
    reporter = ItemReporter("Atlas", "map")
    reporter.report()
```

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
        return self._path[self._path.rfind("/") + 1:]

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        content = self._content.strip()
        if not content:
            return 0
        return len(content.split())

    def readable(self) -> bool:
        """Responsibilities: _content readability classification_."""
        return len(self._content.strip()) > 0

    def content_summary(self) -> str:
        """Responsibilities: _entry summary_."""
        return f"{self.file_name()} ({self.word_count()} words)"

    def readability_label(self) -> str:
        """Responsibilities: _readability label_."""
        if self.readable():
            return "readable"
        return "empty"

    def report(self) -> None:
        """Responsibilities: _entry report_."""
        print(f"{self.content_summary()}: {self.readability_label()}")
# File: cli.py
from src.file_entry.file_entry import FileEntry

if __name__ == "__main__":
    entry = FileEntry("notes.txt", "hello world")
    entry.report()
```
