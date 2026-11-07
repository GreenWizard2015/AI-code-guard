# Test production usage

Description: Each test must call imported production code and assert its observable result directly. A fixture, setup hook, or helper cannot perform the tested work for it.

## Bad




```python
# File: src/documentation/test_production_usage/message_parser.py
class MessageParser:

    def parse(self, text: str) -> str:
        return text
# File: tests/documentation/test_production_usage/test_message_parser.py
import unittest
from src.documentation.test_production_usage.message_parser import MessageParser

class TestMessageParser(unittest.TestCase):
    def test_uses_a_helper_result(self) -> None:
        self.assertEqual(parsed_message_fixture(), "hello")
    def test_parses_a_value_directly(self) -> None:
        parser = MessageParser()
        self.assertEqual(parser.parse("world"), "world")

def parsed_message_fixture() -> str:
    return MessageParser().parse("hello")
# File: src/documentation/test_production_usage/output.py
class OutputReporter:
    def write(self, message: str) -> None:
        print(message)
# File: src/cli.py
from src.documentation.test_production_usage.message_parser import MessageParser
from src.documentation.test_production_usage.output import OutputReporter

if __name__ == "__main__":
    parser = MessageParser()
    parsed_message = parser.parse("hello")
    reporter = OutputReporter()
    reporter.write(parsed_message)
```

## Good

```python
# File: src/documentation/test_production_usage/message.py
class Message:
    def __init__(self, content: str) -> None:
        self._content: str = content

    def normalized_text(self) -> str:
        return " ".join(self._content.split())

    def word_count(self) -> int:
        return len(self.normalized_text().split())

    def empty(self) -> bool:
        return self.word_count() == 0

    def summary(self) -> str:
        if self.empty():
            return "empty message"
        return f"{self.normalized_text()} ({self.word_count()} words)"

    def report(self) -> str:
        summary = self.summary()
        print(summary)
        return summary
# File: tests/documentation/test_production_usage/test_message.py
import unittest
from src.documentation.test_production_usage.message import Message
class TestMessage(unittest.TestCase):
    def test_normalizes_message_text(self) -> None:
        message = Message(" hello   world ")
        normalized = message.normalized_text()
        self.assertEqual(normalized, "hello world")

    def test_counts_message_words(self) -> None:
        message = Message(" hello   world ")
        count = message.word_count()
        self.assertEqual(count, 2)

    def test_classifies_blank_message(self) -> None:
        message = Message("   ")
        is_empty = message.empty()
        self.assertTrue(is_empty)

    def test_summarizes_message(self) -> None:
        message = Message(" hello   world ")
        summary = message.summary()
        self.assertEqual(summary, "hello world (2 words)")

    def test_reports_message_text(self) -> None:
        message = Message(" hello   world ")
        report = message.report()
        self.assertEqual(report, "hello world (2 words)")
# File: cli.py
from src.documentation.test_production_usage.message import Message
if __name__ == "__main__":
    message = Message("cli payload")
    message.report()
```
