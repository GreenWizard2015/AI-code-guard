# `assignment-expression`

Description: Do not use Python's `:=` assignment expression. Assign the value in
a separate statement so that assignment is visible and separate from expression
evaluation.

## Bad

```python
# File: src/message_report.py
class MessageReport:
    def __init__(self, prefix: str) -> None:
        self._prefix: str = prefix.strip()

    def normalize(self, raw_text: str) -> str:
        return " ".join(raw_text.split())

    def contains_text(self, candidate: str) -> bool:
        return bool(candidate.strip())

    def render(self, value: str) -> str:
        return f"{self._prefix}: {value}"

    def report(self, message: str) -> None:
        normalized = self.normalize(message)
        if not self.contains_text(normalized):
            return
        print(self.render(normalized))
# File: src/cli.py
from src.message_report import MessageReport

if __name__ == "__main__":
    reporter = MessageReport("status")
    message = " ready "
    if match := message.strip():  # <- error
        reporter.report(match)
```

## Good

```python
# File: src/message_report.py
class MessageReport:
    def __init__(self, prefix: str) -> None:
        self._prefix: str = prefix.strip()

    def normalize(self, raw_text: str) -> str:
        return " ".join(raw_text.split())

    def contains_text(self, candidate: str) -> bool:
        return bool(candidate.strip())

    def render(self, value: str) -> str:
        return f"{self._prefix}: {value}"

    def report(self, message: str) -> None:
        normalized = self.normalize(message)
        if not self.contains_text(normalized):
            return
        print(self.render(normalized))
# File: src/cli.py
from src.message_report import MessageReport

if __name__ == "__main__":
    reporter = MessageReport("status")
    message = " ready "
    match = message.strip()
    if match:
        reporter.report(match)
```
