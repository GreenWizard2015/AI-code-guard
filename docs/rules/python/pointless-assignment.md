# `pointless-assignment`

Description: A temporary assigned and immediately returned value adds indirection.


## Bad


```python
# File: src/message.py
class Message:
    def __init__(self, content: str, category: str, channel: str) -> None:
        self._content: str = content
        self._category: str = category
        self._channel: str = channel
    def render(self) -> str:
        display_text = f"[{self._content.strip()}]"
        return display_text
    def word_count(self) -> int:
        text = self.render()
        return len(text.split())
    def summary(self) -> str:
        text = self.render()
        category_label = self._category.upper()
        count = self.word_count()
        return f"{category_label}@{self._channel}: {text} ({len(text)}, {count})"
    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.message import Message

if __name__ == "__main__":
    message = Message(" ready ", "status", "console")
    message.report()
```

**Fix:** Return `build(input)` directly unless the name is reused or documents a real transition.

The target diagnostic is demonstrated by the `result` assignment immediately returned above.

## Good


```python
# File: src/message.py
class Message:
    def __init__(self, content: str, category: str, channel: str) -> None:
        self._content: str = content
        self._category: str = category
        self._channel: str = channel
    def render(self) -> str:
        return f"[{self._content.strip()}]"
    def word_count(self) -> int:
        text = self.render()
        return len(text.split())
    def summary(self) -> str:
        text = self.render()
        category_label = self._category.upper()
        count = self.word_count()
        return f"{category_label}@{self._channel}: {text} ({len(text)}, {count})"
    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.message import Message

if __name__ == "__main__":
    message = Message(" ready ", "status", "console")
    message.report()
```
