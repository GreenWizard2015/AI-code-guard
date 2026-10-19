# `unasserted-async-completion`

Description: Await asynchronous work in tests so the test observes completion and failures.
The rule reports a direct, standalone call to a locally declared async
function in a test body. Production files and nested callbacks are outside its
scope.

## Bad


```python
# File: src/file_entry/file_entry.py
class FileEntry:
    def __init__(self, path: str, content: str) -> None:
        normalized_path = path.replace("\\", "/")
        self.path: str = normalized_path.strip()
        self.content: str = content

    def file_name(self) -> str:
        path_parts = self.path.split("/")
        return path_parts[-1]

    def word_count(self) -> int:
        return len(self.content.split())

    def readable(self) -> bool:
        normalized_content = self.content.strip()
        return len(normalized_content) > 0

    def summary(self) -> str:
        return f"{self.file_name()} ({self.word_count()} words)"

# File: tests/file_entry/test_async_operation.py
import asyncio
import unittest

from src.file_entry.file_entry import FileEntry

async def load_label(entry: FileEntry) -> str:
    await asyncio.sleep(0)
    return f"file: {entry.file_name()}"

class TestAsyncOperation(unittest.TestCase):
    def test_observes_local_async_operation(self) -> None:
        entry = FileEntry("notes.txt", "hello world")
        load_label(entry)  # <- error
        self.assertEqual(entry.file_name(), "notes.txt")

    def test_checks_another_result(self) -> None:
        entry = FileEntry("notes.txt", "hello world")
        self.assertEqual(entry.word_count(), 2)
# File: cli.py
from src.file_entry.file_entry import FileEntry

if __name__ == "__main__":
    entry = FileEntry("guide.txt", "dispatch text")
    print(
        entry.file_name(), entry.word_count(), entry.readable(),
        entry.summary(),
    )
```

## Good


```python
# File: tests/file_entry/async_file_entry_test.py
import asyncio
import unittest

from src.file_entry.file_entry import FileEntry

class FileEntryTests(unittest.TestCase):
    """Responsibilities: _file entry behavior tests_."""

    def test_awaits_the_entry_operation(self) -> None:
        """Responsibilities: _file name result_."""
        entry = FileEntry("notes.txt", "hello world")
        label = asyncio.run(self._entry_label(entry))
        self.assertEqual(label, "notes.txt")

    def test_awaits_the_content_operation(self) -> None:
        """Responsibilities: _word count result_."""
        entry = FileEntry("notes.txt", "hello world")
        words = asyncio.run(self._word_count(entry))
        self.assertEqual(words, 2)

    async def _entry_label(self, entry: FileEntry) -> str:
        """Responsibilities: _file label completion_."""
        return entry.file_name()

    async def _word_count(self, entry: FileEntry) -> int:
        """Responsibilities: _word count completion_."""
        return entry.word_count()
# File: src/file_entry/file_entry.py
class FileEntry:
    """Responsibilities: _file entry state_."""

    def __init__(self, path: str, content: str) -> None:
        """Responsibilities: _file entry initialization_."""
        normalized_path = path.replace("\\", "/")
        self.path: str = normalized_path.strip()
        self.content: str = content

    def file_name(self) -> str:
        """Responsibilities: _file label composition_."""
        path_parts = self.path.split("/")
        return path_parts[-1]

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        return len(self.content.split())

    def readable(self) -> bool:
        """Responsibilities: _content readability classification_."""
        normalized_content = self.content.strip()
        return len(normalized_content) > 0

    def summary(self) -> str:
        """Responsibilities: _entry summary_."""
        return f"{self.file_name()} ({self.word_count()} words)"

# File: cli.py
from src.file_entry.file_entry import FileEntry
if __name__ == "__main__":
    entry = FileEntry("guide.md", "dispatch text")
    print(
        entry.file_name(), entry.word_count(), entry.readable(),
        entry.summary(),
    )
```
