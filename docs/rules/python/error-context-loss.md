# error-context-loss

Description: Reports only explicit exception-context suppression:

- TypeScript catches a named error and throws a new `*Error` without using the
  caught error, its message, or a `cause` property.
- Python uses `raise ... from None` inside an exception handler.

Rethrowing the original error, passing it to the new error, and ordinary
boundary translation remain allowed.

## Bad


```python
# File: src/document_parser.py
class DocumentParser:
    """Responsibilities: _document parsing_."""

    def __init__(self, source_text: str) -> None:
        """Responsibilities: _parser initialization_."""
        self._source_text: str = source_text

    def _decode_document(self) -> str:
        """Responsibilities: _source decoding_."""
        if not self._source_text.strip():
            raise ValueError("Document is empty")
        return self._source_text.strip()

    def parse_document(self) -> str:
        """Responsibilities: _document error translation_."""
        try:
            return self._decode_document()
        except ValueError:
            raise ValueError("Invalid document") from None  # <- error

    def report(self) -> None:
        """Responsibilities: _parse status output_."""
        print(f"Parsed: {self.parse_document()}")
# File: cli.py
from src.document_parser import DocumentParser

if __name__ == "__main__":
    parser = DocumentParser("valid document")
    parser.report()
```

## Good


```python
# File: src/document_record.py
class DocumentRecord:
    """Responsibilities: _document parsing_."""

    def __init__(self, source_text: str) -> None:
        """Responsibilities: _record initialization_."""
        self._source_text: str = source_text

    def content_text(self) -> str:
        """Responsibilities: _document error translation_."""
        normalized_text = self._source_text.strip()
        if not normalized_text:
            raise ValueError("Document is empty")
        return normalized_text

    def document_length(self) -> int:
        """Responsibilities: _document character measurement_."""
        normalized_text = self.content_text()
        return len(normalized_text)

    def word_count(self) -> int:
        """Responsibilities: _document word measurement_."""
        return len(self.content_text().split())

    def report(self) -> None:
        """Responsibilities: _parse status output_."""
        content = self.content_text()
        print(f"Parsed: {content} ({self.document_length()} characters, {self.word_count()} words)")
# File: cli.py
from src.document_record import DocumentRecord

if __name__ == "__main__":
    document = DocumentRecord("valid document")
    document.report()
```
