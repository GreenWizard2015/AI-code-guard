# `method-parse-convert-transform-name`

Description: Review public non-boolean result methods beginning with `parse*`, `convert*`,
or `transform*`. These names can expose a procedural `data → operation → data`
pipeline. Prefer the representation or value object: `parseJson()` → `json()`
or `ParsedJson`, `convertImage()` → `PngImage`.

## Bad


```python
# File: src/document_text.py
class DocumentText:
    def __init__(self, raw_document: str) -> None:
        self._raw_document: str = raw_document

    def parse_document(self) -> str:  # <- error
        words = self._raw_document.strip().split()
        normalized = " ".join(words)
        return normalized

    def word_count(self) -> int:
        words = self.parse_document().split()
        return len(words)

    def summary(self) -> str:
        document = self.parse_document()
        count = self.word_count()
        return f"{count} words: {document}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.document_text import DocumentText

if __name__ == "__main__":
    document = DocumentText("ready document")
    document.report()
```

## Good


```python
# File: src/document_text.py
class DocumentText:
    """Responsibilities: _document text representation_, _word measurement_."""

    def __init__(self, raw_document: str) -> None:
        """Responsibilities: _document initialization_."""
        self._raw_document: str = raw_document

    def document_text(self) -> str:
        """Responsibilities: _document text representation_."""
        parts = self._raw_document.strip().split()
        normalized_parts = [part for part in parts if part]
        return " ".join(normalized_parts)

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        count = 0
        for part in self.document_text().split():
            if part:
                count += 1
        return count

    def summary(self) -> str:
        """Responsibilities: _document summary_."""
        document = self.document_text()
        count = self.word_count()
        return f"{count} words: {document}"

    def report(self) -> None:
        """Responsibilities: _document report output_."""
        summary = self.summary()
        print(summary)
# File: cli.py
from src.document_text import DocumentText

if __name__ == "__main__":
    document = DocumentText("ready document")
    document.report()
```
