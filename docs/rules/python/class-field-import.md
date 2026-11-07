# `class-field-import`

Description: Do not assign an imported function directly to a class field. Inject a
collaborator or put the operation behind a method owned by the class.

## Bad


```python
# File: src/query_normalizer.py
from src.text_functions import normalize_text

class QueryNormalizer:
    normalize = normalize_text

    def report(self) -> None:
        normalized = QueryNormalizer.normalize("  ready  ")
        print(f"Query: {normalized}")
# File: src/text_functions.py
def normalize_text(value: str) -> str:
    return value.strip()
# File: cli.py
from src.query_normalizer import QueryNormalizer

if __name__ == "__main__":
    normalizer = QueryNormalizer()
    normalizer.report()
```

## Good


```python
# File: src/text_normalizer.py
class TextNormalizer:
    """Responsibilities: _text normalization state_."""

    def __init__(self, separator: str) -> None:
        """Responsibilities: _normalizer initialization_."""
        self._separator: str = separator

    def normalize_text(self, text: str) -> str:
        """Responsibilities: _text normalization_."""
        normalized = " ".join(text.split())
        return normalized.replace(" ", self._separator)

    def display_text(self, label: str) -> str:
        """Responsibilities: _display label composition_."""
        normalized = self.normalize_text(label)
        return f"[{normalized}]"

    def word_count(self, source: str) -> int:
        """Responsibilities: _word count_."""
        normalized = self.normalize_text(source)
        return len(normalized.split(self._separator))

    def report(self) -> None:
        normalized = self.normalize_text(" fresh query ")
        display = self.display_text("restricted")
        count = self.word_count("publish report")
        print(f"{normalized} {display} {count}")

# File: cli.py
from src.text_normalizer import TextNormalizer

if __name__ == "__main__":
    normalizer = TextNormalizer(" ")
    normalizer.report()
```
