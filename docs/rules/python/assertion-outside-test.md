# assertion-outside-test

Description: Keep assertions inside recognized test cases; this rule does not apply to production files.

## Bad


```python
# File: tests/http_response/http_response_test.py
assert value == 1  # <- error
```

## Good


```python
# Supporting production code only; the assertions remain explicit below.
# File: src/documentation/text_value.py
class TextValue:
    def __init__(self, raw_text: str) -> None:
        self.raw_text: str = raw_text

    def normalized(self) -> str:
        return ' '.join(self.raw_text.lower().split())

    def present(self) -> bool:
        return len(self.normalized()) > 0

    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return f'{clean_prefix}: {self.normalized()}'

    def word_count(self) -> int:
        words = self.normalized().split()
        return len(words)

    def same_as(self, other: str) -> bool:
        return self.normalized() == other.strip().lower()
# File: tests/documentation/test_text_value.py
import unittest
from src.documentation.text_value import TextValue

class TestTextValue(unittest.TestCase):
    def test_normalizes_text(self) -> None:
        value = TextValue(' READY ')
        normalized = value.normalized()
        self.assertEqual(normalized, 'ready')
    def test_content_is_present(self) -> None:
        value = TextValue('ready')
        present = value.present()
        self.assertTrue(present)
# File: cli.py
from src.documentation.text_value import TextValue
if __name__ == '__main__':
    value = TextValue(' Ready ')
    value.normalized()
    value.present()
    value.label('State')
    value.word_count()
    value.same_as('ready')
```
