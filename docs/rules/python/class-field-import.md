# `class-field-import`

Description: Do not assign an imported function directly to a class field. Inject a
collaborator or put the operation behind a method owned by the class.

## Bad


```python
# File: src/query_normalizer.py
from src.text_functions import normalize_text

class QueryNormalizer:
    normalize = normalize_text
# File: src/text_functions.py
def normalize_text(value: str) -> str:
    return value.strip()
```

## Good


```python
# File: src/text_normalizer.py
class TextNormalizer:
    """Responsibilities: _text normalization state_."""

    def __init__(self, separator: str) -> None:
        """Responsibilities: _normalizer initialization_."""
        self.separator: str = separator

    def normalize_text(self, text: str) -> str:
        """Responsibilities: _text normalization_."""
        normalized = " ".join(text.split())
        return normalized.replace(" ", self.separator)

    def display_text(self, text: str) -> str:
        """Responsibilities: _display label composition_."""
        normalized = self.normalize_text(text)
        return f"[{normalized}]"

    def word_count(self, text: str) -> int:
        """Responsibilities: _word count_."""
        normalized = self.normalize_text(text)
        return len(normalized.split(self.separator))

    def uppercase_text(self, text: str) -> str:
        """Responsibilities: _text capitalization_."""
        normalized = self.normalize_text(text)
        return normalized.upper()
# File: cli.py
from src.text_normalizer import TextNormalizer

if __name__ == "__main__":
    normalizer = TextNormalizer(" ")
    normalized = normalizer.normalize_text("  ready  ")
    display = normalizer.display_text("blocked")
    count = normalizer.word_count("ready to publish")
    uppercase = normalizer.uppercase_text("ready")
    print(f"{normalized} {display} {count} {uppercase}")
```
