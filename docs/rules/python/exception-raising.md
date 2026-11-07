# `exception-raising`

Description: Keep test control flow explicit without exceptions.

The rule reports TypeScript `throw` and Python `raise` only in files identified as tests by their filename. A support module under `tests/` is not a test file by location alone.


Fix: Return an explicit result or handle failure without an exception.
Do not use `raise` or `throw` in tests.

## Bad


```python
# File: src/text_document.py
class TextDocument:
    def __init__(self, source_text: str) -> None:
        self._source_text: str = source_text

    def contents(self) -> str:
        words = self._source_text.strip().split()
        normalized_text = " ".join(words)
        return normalized_text

    def word_count(self) -> int:
        text = self.contents()
        if len(text) == 0:
            return 0
        return len(text.split())

    def summary(self) -> str:
        return f"Document ({self.word_count()} words): {self.contents()}"

    def report(self) -> None:
        print(self.summary())
# File: tests/text_document/test_text_document.py
import unittest
from src.text_document import TextDocument

class TestTextDocument(unittest.TestCase):
    def test_guards_content(self) -> None:
        document = TextDocument("ready")
        contents = document.contents()
        if len(contents) == 0:
            raise ValueError("Document content is empty.")  # <- error
        self.assertEqual(contents, "ready")

    def test_summarizes_content(self) -> None:
        document = TextDocument("ready state")
        self.assertEqual(document.summary(), "Document (2 words): ready state")
# File: cli.py
from src.text_document import TextDocument

if __name__ == "__main__":
    document = TextDocument("ready state")
    document.report()
```

## Good


```python
# File: src/text_document.py
class TextDocument:
    def __init__(self, source_text: str) -> None:
        self._source_text: str = source_text

    def contents(self) -> str:
        return " ".join(self._source_text.strip().split())

    def word_count(self) -> int:
        text = self.contents()
        if len(text) == 0:
            return 0
        return len(text.split())

    def summary(self) -> str:
        return f"Document ({self.word_count()} words): {self.contents()}"

    def report(self) -> None:
        print(self.summary())
# File: tests/text_document/test_text_document.py
import unittest
from src.text_document import TextDocument

class TestTextDocument(unittest.TestCase):
    def test_normalizes_content(self) -> None:
        document = TextDocument(" ready  state ")
        self.assertEqual(document.contents(), "ready state")

    def test_summarizes_content(self) -> None:
        document = TextDocument("ready state")
        self.assertEqual(document.summary(), "Document (2 words): ready state")
# File: cli.py
from src.text_document import TextDocument

if __name__ == "__main__":
    document = TextDocument("ready state")
    document.report()
```
