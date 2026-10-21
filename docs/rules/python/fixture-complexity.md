# `fixture-complexity`

Description: Keep Jest and `unittest` lifecycle hooks within the ordinary callable-size limit.
Build only the shared data the tests use; move substantial reusable setup into a focused fixture.

## Bad

```python
{% const documents = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey", "xray", "yankee"] %}
# File: tests/file_entry/file_entry_test.py
import unittest
from src.file_entry.file_entry import FileEntry

class FileEntryTests(unittest.TestCase):
    def setUp(self) -> None:  # <- error
        self.entries: list[FileEntry] = []
{%for document in documents %}
        self.entries.append(FileEntry("{{document}}.txt", "{{document}} text"))
{% endfor %}

    def test_counts_words(self) -> None:
        total_words = sum(entry.word_count() for entry in self.entries)
        self.assertEqual(total_words, 50)

    def test_extracts_the_file_name(self) -> None:
        self.assertEqual(self.entries[1].file_name(), "bravo.txt")

# File: src/file_entry/file_entry.py
class FileEntry:

    def __init__(self, path: str, content: str) -> None:
        self.path: str = path
        self.content: str = content

    def file_name(self) -> str:
        return self.path[self.path.rfind("/") + 1:]

    def word_count(self) -> int:
        content = self.content.strip()
        if not content:
            return 0
        return len(content.split())

    def readable(self) -> bool:
        return len(self.content.strip()) > 0

    def content_summary(self) -> str:
        return f"{self.file_name()} ({self.word_count()} words)"
```

## Good

```python
# File: tests/file_entry/file_entry_test.py
import unittest

from src.file_entry.file_entry import FileEntry

class FileEntryTests(unittest.TestCase):
    """Responsibilities: _file entry behavior tests_."""

    def test_counts_words_in_the_content(self) -> None:
        """Responsibilities: _content word count behavior_."""
        entry = FileEntry("notes.txt", "hello world")
        self.assertEqual(entry.word_count(), 2)
        self.assertTrue(entry.readable())

    def test_extracts_the_file_name(self) -> None:
        """Responsibilities: _file name extraction behavior_."""
        entry = FileEntry("docs/notes.txt", "hello")
        self.assertEqual(entry.file_name(), "notes.txt")
        self.assertEqual(entry.content_summary(), "notes.txt (1 words)")

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
    entry = FileEntry("guide.md", "dispatch text")
    print(entry.file_name(), entry.word_count(), entry.readable(), entry.content_summary())
```
