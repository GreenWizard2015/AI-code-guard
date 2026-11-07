# `duplicate-error-translation`

Description: Reports a production `catch` or `except` handler that constructs the identical
error translation more than once. Preserve meaningful differences in error
category or context; merge paths that produce the same result.

## Bad


```python
# File: src/document_archive.py
class DocumentArchive:
    """Responsibilities: _document content_, _error context_."""

    def _source_value(self) -> str:
        """Responsibilities: _source value validation_."""
        source = self._raw_text.strip()
        if len(source) == 0:
            raise ValueError("Empty document.")
        return source

    def __init__(self, raw_text: str) -> None:
        """Responsibilities: _archive initialization_."""
        self._raw_text: str = raw_text

    def contents(self) -> str:
        """Responsibilities: _document content access_."""
        try:
            source = self._source_value()
            return source.upper()
        except ValueError as error:
            if len(error.args) > 0:
                raise RuntimeError("Document content is invalid.") from error
            raise RuntimeError("Document content is invalid.") from error  # <- error

    def report(self) -> None:
        """Responsibilities: _archive report output_."""
        print(f"Document: {self.contents()}")

# File: cli.py
from src.document_archive import DocumentArchive

if __name__ == "__main__":
    archive = DocumentArchive("ready")
    archive.report()
```

## Good


```python
# File: src/document_archive.py
class DocumentArchive:
    """Responsibilities: _document content_, _error context_."""

    def _source_value(self) -> str:
        """Responsibilities: _source value validation_."""
        source = self._raw_text.strip()
        if len(source) == 0:
            raise ValueError("Empty document.")
        return source

    def __init__(self, raw_text: str) -> None:
        """Responsibilities: _archive initialization_."""
        self._raw_text: str = raw_text

    def contents(self) -> str:
        """Responsibilities: _document content access_."""
        return self._source_value().upper()

    def word_count(self) -> int:
        """Responsibilities: _document word counting_."""
        words = self._source_value().split()
        return len(words)

    def populated(self) -> bool:
        """Responsibilities: _document presence classification_."""
        source_value = self._source_value()
        return len(source_value) > 0

    def report(self) -> None:
        """Responsibilities: _archive report output_."""
        content = self.contents()
        word_count = self.word_count()
        populated = self.populated()
        print(f"Document: {content} ({word_count} words, populated={populated})")

# File: cli.py
from src.document_archive import DocumentArchive

if __name__ == "__main__":
    archive = DocumentArchive("ready")
    archive.report()
```
