# test-assert-statement

Description: Use `unittest` assertions instead of bare Python `assert` statements in tests.

## Bad

```python
# File: src/text_value.py
class TextValue:

    def __init__(self, raw_text: str) -> None:
        self.raw_text: str = raw_text

    def normalized(self) -> str:
        return ' '.join(self.raw_text.strip().lower().split())

    def present(self) -> bool:
        return len(self.normalized()) > 0

    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()

    def word_count(self) -> int:
        return len(self.normalized().split())

    def contains(self, word: str) -> bool:
        return word.lower() in self.normalized().split()
# File: tests/text_value/test_text_value.py
import unittest
from src.text_value import TextValue

class TestTextValue(unittest.TestCase):
    def test_normalized_text(self) -> None:
        value = TextValue(" READY ")
        normalized = value.normalized()
        assert normalized == "ready"
# File: cli.py
from src.text_value import TextValue
if __name__ == '__main__':
    cli_value = TextValue('CLI value')
    cli_value.normalized()
    cli_value.present()
    cli_value.label('Mode')
    cli_value.word_count()
    cli_value.contains('value')
```

## Good

```python
# File: src/text_value.py
class TextValue:
    """Responsibilities: _text value behavior_."""

    def __init__(self, raw_text: str) -> None:
        """Responsibilities: _text value initialization_."""
        self.raw_text: str = raw_text

    def normalized(self) -> str:
        """Responsibilities: _text normalization_."""
        return ' '.join(self.raw_text.strip().lower().split())

    def present(self) -> bool:
        """Responsibilities: _content presence classification_."""
        return len(self.normalized()) > 0

    def label(self, prefix: str) -> str:
        """Responsibilities: _text label composition_."""
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()

    def word_count(self) -> int:
        """Responsibilities: _word counting_."""
        return len(self.normalized().split())

    def contains(self, word: str) -> bool:
        """Responsibilities: _word membership_."""
        return word.lower() in self.normalized().split()
# File: tests/text_value/test_text_value.py
import unittest
from src.text_value import TextValue

class TestTextValue(unittest.TestCase):
    def test_normalized_text(self) -> None:
        value = TextValue(" READY ")
        normalized = value.normalized()
        self.assertEqual(normalized, "ready")

    def test_content_presence(self) -> None:
        value = TextValue("text")
        content_present = value.has_content()
        self.assertTrue(content_present)
# File: cli.py
from src.text_value import TextValue
if __name__ == '__main__':
    cli_value = TextValue('CLI value')
    cli_value.normalized()
    cli_value.present()
    cli_value.label('Mode')
    cli_value.word_count()
    cli_value.contains('value')
```
