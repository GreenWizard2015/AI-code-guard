# `type-info`

Description: Prefer a concrete value contract or focused protocol over unbounded boundary types.

This applies to both languages. In TypeScript it includes `any`, `unknown`, and
`object`; in Python it includes `Any`, `typing.Any`, `typing_extensions.Any`,
`object`, and equivalent unbounded aliases. Use a concrete value type or a
focused protocol instead.

## Bad


```python
# File: src/message.py
class Message:
    def __init__(self, value: object, context: str) -> None:
        self.value: object = value
        self.context: str = context
    def render(self) -> str:
        text = str(self.value).strip()
        if len(text) == 0:
            return "(empty)"
        return text
    def normalized_text(self) -> str:
        return self.render().strip().lower()
    def words(self) -> list[str]:
        text = self.normalized_text()
        if text == "(empty)":
            return []
        return [word for word in text.split() if word]
    def report(self) -> None:
        display_text = self.render()
        count = len(self.words())
        print(f"{self.context}: {display_text}: {count}")
# File: cli.py
if __name__ == "__main__":
    from src.message import Message
    message = Message("READY", "queue")
    message.report()
```

## Good


```python
# File: src/message.py
class Message:
    def __init__(self, value: str, context: str) -> None:
        self._value: str = value
        self._context: str = context
    def render(self) -> str:
        text = self._value.strip()
        if len(text) == 0:
            return "(empty)"
        return text
    def normalized_text(self) -> str:
        return self.render().strip().lower()
    def words(self) -> list[str]:
        text = self.normalized_text()
        if text == "(empty)":
            return []
        return [word for word in text.split() if word]
    def report(self) -> None:
        display_text = self.render()
        count = len(self.words())
        print(f"{self._context}: {display_text}: {count}")
# File: cli.py
if __name__ == "__main__":
    from src.message import Message
    message = Message("READY", "queue")
    message.report()
```
