# `unused-callable`

Description: Remove or refactor production callables that have no meaningful production consumers.

## Bad


```python
# File: src/message_text.py
class MessageText:
    def __init__(self, value_text: str) -> None:
        self.value_text: str = value_text
    def normalized_text(self) -> str:
        return self.value_text.strip()
    def uppercase_text(self) -> str:  # <- error
        return self.value_text.upper()
# File: cli.py
from src.message_text import MessageText
if __name__ == "__main__":
    message = MessageText("hello")
    print(message.normalized_text())
```

## Good


```python
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
# File: cli.py
from src.documentation.test_production_usage.message import Message
if __name__ == "__main__":
    message = Message("cli payload")
    print(message.normalized_text(), message.word_count(), message.empty(), message.contains("cli"), message.uppercase_text())
```
