# `unused-callable`

Description: Remove or refactor production callables that have no meaningful production consumers.

## Bad


```python
# File: src/message_text.py
class MessageText:
    def __init__(self, value_text: str) -> None:
        self.__value_text: str = value_text

    def normalized_text(self) -> str:
        return " ".join(self.__value_text.split())

    def word_count(self) -> int:
        normalized = self.normalized_text()
        if not normalized:
            return 0
        return len(normalized.split(" "))

    def uppercase_text(self) -> str:  # <- error
        return self.normalized_text().upper()

    def report(self) -> None:
        normalized = self.normalized_text()
        count = self.word_count()
        uppercase = normalized.upper()
        print(f"{normalized} | {count} | {uppercase}")
# File: cli.py
from src.message_text import MessageText

if __name__ == "__main__":
    message = MessageText("  cli   payload ")
    message.report()
```

## Good


```python
# File: src/message.py
class Message:
    def __init__(self, content: str) -> None:
        self.__content: str = content

    def normalized_text(self) -> str:
        trimmed_content = self.__content.strip()
        if not trimmed_content:
            return ""
        words = trimmed_content.split()
        normalized_words: list[str] = []
        for word in words:
            if word:
                normalized_words.append(word)
        return " ".join(normalized_words)

    def word_count(self) -> int:
        normalized = self.normalized_text()
        if not normalized:
            return 0
        words = normalized.split(" ")
        count = 0
        for word in words:
            if word:
                count += 1
        return count

    def uppercase_text(self) -> str:
        normalized = self.normalized_text()
        return normalized.upper()

    def report(self) -> None:
        normalized = self.normalized_text()
        count = self.word_count()
        uppercase = self.uppercase_text()
        fields = [normalized, str(count), uppercase]
        report_line = " | ".join(fields)
        print(report_line)

# File: cli.py
from src.message import Message
if __name__ == "__main__":
    message = Message("  cli   payload ")
    message.report()
```
