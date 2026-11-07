# `unused-class`

Description: Reports a production implementation class with no production symbol usage.
Tests do not count as production usage. Entry-point files and protocol/type-contract
classes are excluded.

## Bad


```python
# File: src/message_text.py
MESSAGE_SEPARATOR: str = " | "


class MessageText:  # <- error
    def __init__(self, content: str) -> None:
        self._content: str = content

    def normalized_text(self) -> str:
        return " ".join(self._content.split())

    def word_count(self) -> int:
        return len(self.normalized_text().split())

    def text(self) -> str:
        return self.normalized_text()

    def report(self) -> None:
        print(f"{self.text()} ({self.word_count()} words)")
# File: src/status_reporter.py
from src.message_text import MESSAGE_SEPARATOR


class StatusReporter:
    def __init__(self, status: str) -> None:
        self._status: str = status

    def text(self) -> str:
        return f"Status: {self._status.strip().lower()}"

    def report(self) -> None:
        print(f"{MESSAGE_SEPARATOR}{self.text()}")
# File: cli.py
from src.status_reporter import StatusReporter

if __name__ == "__main__":
    reporter = StatusReporter("READY")
    reporter.report()
```

## Good


```python
# File: src/message_text.py
class MessageText:
    def __init__(self, content: str) -> None:
        self._content: str = content

    def normalized_text(self) -> str:
        trimmed = self._content.strip()
        return " ".join(trimmed.split())

    def word_count(self) -> int:
        text = self.normalized_text()
        if not text:
            return 0
        return len(text.split())

    def summary(self) -> str:
        details = [
            self.normalized_text(),
            str(self.word_count()),
        ]
        return " | ".join(details)

# File: src/message_archive.py
from src.message_text import MessageText


class MessageArchive:
    _messages: list[MessageText]

    def __init__(self) -> None:
        self._messages = []

    def record_content(self, content_text: str) -> None:
        message = MessageText(content_text)
        if message.normalized_text():
            self._messages.append(message)

    def message_count(self) -> int:
        return len(self._messages)

    def summary(self) -> str:
        message_summaries: list[str] = []
        for message in self._messages:
            message_summaries.append(message.summary())
        return f"{self.message_count()} messages: {'; '.join(message_summaries)}"

    def report(self) -> None:
        print(self.summary())

# File: cli.py
from src.message_archive import MessageArchive
if __name__ == "__main__":
    archive = MessageArchive()
    archive.record_content("cli payload")
    archive.report()
```
