# `method-load-read-open-name`

Description: Review public non-boolean result methods beginning with `load*`, `read*`, or
`open*`. Prefer the returned value or representation: `content()` may read a
file, use a cache, call HTTP, or return an existing object without exposing
that implementation choice.

## Bad

```python
# File: src/document_content.py
class DocumentContent:
    def __init__(self, title_text: str, body_text: str) -> None:
        self._title_text: str = title_text
        self._body_text: str = body_text

    def load_content(self) -> str:  # <- error
        return self._body_text

    def word_count(self) -> int:
        return len(self._body_text.strip().split())

    def summary(self) -> str:
        content = self.load_content()
        words = self.word_count()
        return f"{self._title_text}: {words} words; {content}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.document_content import DocumentContent

if __name__ == "__main__":
    document = DocumentContent("Welcome", "A short guide to the library.")
    document.report()
```

## Good

```python
# File: src/document_content.py
class DocumentContent:
    def __init__(self, title_text: str, body_text: str) -> None:
        self._title_text: str = title_text
        self._body_text: str = body_text

    def content(self) -> str:
        return self._body_text

    def word_count(self) -> int:
        return len(self._body_text.strip().split())

    def summary(self) -> str:
        content = self.content()
        words = self.word_count()
        return f"{self._title_text}: {words} words; {content}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.document_content import DocumentContent

if __name__ == "__main__":
    document = DocumentContent("Welcome", "A short guide to the library.")
    document.report()
```
