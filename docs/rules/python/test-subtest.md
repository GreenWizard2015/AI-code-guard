# test-subtest

Description: Do not use `with self.subTest(...)` or `async with self.subTest(...)` in Python tests. Use independent test methods or `parameterized.expand` instead.

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

    def report(self) -> None:
        summary = self.label('Text')
        word_total = self.word_count()
        has_content = self.present()
        contains_cli = self.contains('cli')
        print(f'{summary} | {word_total} words | present={has_content} | contains_cli={contains_cli}')
# File: tests/text_value/test_text_value.py
import unittest
from src.text_value import TextValue

class TestTextValue(unittest.TestCase):
    def test_text_values(self) -> None:
        with self.subTest(raw_text=" READY "):
            value = TextValue(" READY ")
            self.assertEqual(value.normalized(), "ready")

    def test_word_count(self) -> None:
        value = TextValue("two words")
        self.assertEqual(value.word_count(), 2)
# File: cli.py
from src.text_value import TextValue
if __name__ == '__main__':
    cli_value = TextValue('CLI value')
    cli_value.report()
```

## Good

```python
# File: src/text_value.py
class TextValue:
    """Responsibilities: _text value behavior_."""

    def __init__(self, raw_text: str) -> None:
        """Responsibilities: _text value initialization_."""
        self._raw_text: str = raw_text

    def normalized(self) -> str:
        """Responsibilities: _text normalization_."""
        return ' '.join(self._raw_text.strip().lower().split())

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

    def report(self) -> None:
        """Responsibilities: _text value reporting_."""
        summary = self.label('Text')
        word_total = self.word_count()
        has_content = self.present()
        contains_cli = self.contains('cli')
        print(f'{summary} | {word_total} words | present={has_content} | contains_cli={contains_cli}')
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
        content_present = value.present()
        self.assertTrue(content_present)

    def test_word_count(self) -> None:
        value = TextValue("two words")
        self.assertEqual(value.word_count(), 2)
# File: cli.py
from src.text_value import TextValue
if __name__ == '__main__':
    cli_value = TextValue('CLI value')
    cli_value.report()
```
