# `empty-contract`

Description: A naming-only interface or protocol adds indirection without defining a useful
behavior boundary. Keep at least one meaningful operation that consumers need.

## Bad


```python
# File: src/protocols.py
from typing import Protocol

class RepositoryContract(Protocol):
    pass
# File: src/content_reader.py
from src.protocols import RepositoryContract

class ContentReader(RepositoryContract):
    """Responsibilities: _content reading_."""

    def __init__(self, content: str) -> None:
        """Responsibilities: _reader initialization_."""
        self._content: str = content

    def normalized_content(self) -> str:
        """Responsibilities: _content normalization_."""
        return self._content.strip()

    def character_count(self) -> int:
        """Responsibilities: _content length_."""
        return len(self.normalized_content())

    def consume_content(self) -> str:
        """Responsibilities: _content consumption_."""
        return f"Read {self.character_count()} characters: {self.normalized_content()}"

    def report(self) -> None:
        """Responsibilities: _reader output_."""
        print(self.consume_content())
# File: cli.py
from src.content_reader import ContentReader

if __name__ == "__main__":
    reader = ContentReader(" useful content ")
    reader.report()
```

## Good


```python
# File: src/protocols.py
from typing import Protocol

class ContentDocumentContract(Protocol):
    """Responsibilities: _document content contract_."""

    def consume_content(self) -> str: ...
# File: src/content_document.py
from src.protocols import ContentDocumentContract

class ContentDocument(ContentDocumentContract):
    """Responsibilities: _document content processing_, _text measurement_."""

    def __init__(self, content: str) -> None:
        """Responsibilities: _document initialization_."""
        self._content: str = content

    def normalized_content(self) -> str:
        """Responsibilities: _content normalization_."""
        words = self._content.strip().split()
        normalized = " ".join(words)
        return normalized

    def character_count(self) -> int:
        """Responsibilities: _content length_."""
        visible_characters = 0
        for character in self._content:
            if not character.isspace():
                visible_characters += 1
        return visible_characters

    def consume_content(self) -> str:
        """Responsibilities: _content consumption_."""
        normalized = self.normalized_content()
        character_count = self.character_count()
        word_count = len(normalized.split())
        return f"Read {character_count} characters across {word_count} words: {normalized}"

    def report(self) -> None:
        """Responsibilities: _document output_."""
        output = self.consume_content()
        print(output)
# File: cli.py
from src.content_document import ContentDocument

if __name__ == "__main__":
    document = ContentDocument(" useful content ")
    document.report()
```
