# `late-import`

Description: Keep static imports at the beginning of the file after the module docstring and future imports.

## Bad

```python
# File: src/message.py
class Message:
    def __init__(self, text: str) -> None:
        self._text: str = text

    def normalized_text(self) -> str:
        return self._text.strip().upper()

    def is_available(self) -> bool:
        return len(self.normalized_text()) > 0
# File: src/message_status.py
report_prefix = "Status"
from src.message import Message  # <- error

class MessageStatus:
    def __init__(self, message: Message) -> None:
        self._message: Message = message

    def normalized_status(self) -> str:
        text = self._message.normalized_text()
        if len(text) == 0:
            return "UNAVAILABLE"
        return text

    def status_line(self) -> str:
        text = self.normalized_status()
        available = self._message.is_available()
        return f"{report_prefix}: {text} | available={available}"

    def is_reportable(self) -> bool:
        normalized_status = self.normalized_status()
        return self._message.is_available() and len(normalized_status) > 0

    def report(self) -> None:
        line = self.status_line()
        reportable = self.is_reportable()
        print(f"{line} | reportable={reportable}")
# File: cli.py
from src.message import Message
from src.message_status import MessageStatus

if __name__ == "__main__":
    message = Message("ready")
    report = MessageStatus(message)
    report.report()
```

## Good

```python
# File: src/message.py
from src.protocols import MessageContract

class Message(MessageContract):
    def __init__(self, text: str) -> None:
        self._text: str = text

    def normalized_text(self) -> str:
        return self._text.strip().upper()

    def word_count(self) -> int:
        normalized_words = self.normalized_text().split()
        return len(normalized_words)

    def character_count(self) -> int:
        visible_characters = [
            character for character in self.normalized_text() if not character.isspace()
        ]
        return len(visible_characters)

    def summary(self) -> str:
        normalized = self.normalized_text()
        words = self.word_count()
        characters = self.character_count()
        return f"{normalized} ({words} words, {characters} characters)"
# File: src/protocols.py
from typing import Protocol

class MessageContract(Protocol):
    def normalized_text(self) -> str: ...
    def word_count(self) -> int: ...
    def summary(self) -> str: ...
# File: src/message_status.py
from src.protocols import MessageContract

class MessageStatus:
    def __init__(self, message: MessageContract) -> None:
        self._message: MessageContract = message

    def status_line(self) -> str:
        text = self._message.normalized_text()
        if len(text) == 0:
            return "UNAVAILABLE"
        return f"Status: {text}"

    def reportable(self) -> bool:
        status_text = self._message.normalized_text()
        if len(status_text) == 0:
            return False
        return self._message.word_count() > 0

    def status_summary(self) -> str:
        line = self.status_line()
        message_detail = self._message.summary()
        reportability = self.reportable()
        return f"{line} | {message_detail} | reportable={reportability}"

    def report(self) -> None:
        print(self.status_summary())
# File: cli.py
from src.message import Message
from src.message_status import MessageStatus

if __name__ == "__main__":
    message = Message("ready")
    status = MessageStatus(message)
    status.report()
```
