# `direct-class-init`

Description: Direct `Class.__init__` calls bypass normal construction and inheritance invariants.

```python
Base.__init__(self, value)
```


Fix: Use `super().__init__(value)` inside a subclass or construct the object normally.

## Bad

```python
# File: src/status_message.py
class StatusMessage:
    def __init__(self, value: str) -> None:
        self._value: str = value.strip()

    def normalized_value(self) -> str:
        return " ".join(self._value.split())

    def status_label(self) -> str:
        return f"Base status: {self.normalized_value()}"

class ReadyStatusMessage(StatusMessage):
    def __init__(self, value: str) -> None:
        StatusMessage.__init__(self, value)

    def summary(self) -> str:
        return f"Ready status: {self.status_label()}"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.status_message import ReadyStatusMessage

if __name__ == "__main__":
    status = ReadyStatusMessage("ready")
    status.report()
```

## Good

```python
# File: src/ready_status_message.py
class ReadyStatusMessage:
    """A ready status message with its own normalized state."""

    def __init__(self, value: str) -> None:
        self._value: str = " ".join(value.split())

    def normalized_value(self) -> str:
        words = self._value.split()
        normalized_words: list[str] = []
        for word in words:
            normalized_words.append(word.lower())
        return " ".join(normalized_words)

    def status_label(self) -> str:
        return f"Ready status: {self.normalized_value()}"

    def status_length(self) -> int:
        return len(self.normalized_value())

    def status_word_count(self) -> int:
        return len(self.normalized_value().split())

    def summary(self) -> str:
        label = self.status_label()
        length = self.status_length()
        words = self.status_word_count()
        return f"{label} ({length} characters, {words} words)"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.ready_status_message import ReadyStatusMessage

if __name__ == "__main__":
    status = ReadyStatusMessage("ready")
    status.report()
```
