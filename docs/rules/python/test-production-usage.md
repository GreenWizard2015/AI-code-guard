# Test production usage

Description: Each test body must construct or call an imported production class or function and
assert its observable result. A setup hook, fixture, factory, or helper cannot do that work for the
test—even if it returns a real production object or result. Mock-only assertions do not count.

## Bad




```python
# File: src/documentation/test_production_usage/message_parser.py
class MessageParser:

    def parse(self, text: str) -> str:
        return text
# File: tests/documentation/test_production_usage/test_message_parser.py
import unittest
from documentation.test_production_usage.message_parser import MessageParser

class TestMessageParser(unittest.TestCase):
    def test_parses_message(self) -> None:
        self.assertTrue(True)
```

## Good


```python
# File: src/documentation/test_production_usage/message.py
class Message:
    def __init__(self, content: str) -> None:
        self.content: str = content

    def normalized_text(self) -> str:
        trimmed = self.content.strip()
        return " ".join(trimmed.split())

    def word_count(self) -> int:
        text = self.normalized_text()
        if not text:
            return 0
        return len(text.split())

    def empty(self) -> bool:
        return len(self.content) == 0

    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip()
        return normalized_fragment in self.normalized_text()

    def uppercase_text(self) -> str:
        return self.normalized_text().upper()
# File: tests/documentation/test_production_usage/test_message.py
import unittest
from src.documentation.test_production_usage.message import Message
class TestMessage(unittest.TestCase):
    def test_normalizes_message(self) -> None:
        message = Message(" hello   world ")
        actual = message.normalized_text()
        self.assertEqual(actual, "hello world")
    def test_counts_message_words(self) -> None:
        message = Message("two words")
        actual = message.word_count()
        self.assertEqual(actual, 2)
# File: cli.py
from src.documentation.test_production_usage.message import Message
if __name__ == "__main__":
    message = Message("cli payload")
    text = message.normalized_text()
    words = message.word_count()
    print(text, words, message.empty(), message.contains("cli"), message.uppercase_text())
```
