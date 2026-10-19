# `static-method`

Description: A Python static helper with no instance state is usually a module function.

```python
class Parser:
    parser_name: str

    def __init__(self, parser_name: str):
        self.parser_name = parser_name

    @staticmethod
    def parse(text: str) -> Result:
        if not text:
            raise ValueError('text is required')
        result = parse_text(text)
        if result.error_count > 0:
            raise ValueError('text is invalid')
        return result
```


Fix: Move it to `parse(text: str) -> Result` with explicit dependencies.

## Bad

```python
class Parser:
    def __init__(self, prefix: str) -> None:
        self.prefix: str = prefix

    @staticmethod
    def parse(text: str) -> str:
        return text.strip().lower()
```

## Good

```python
# File: src/message_policy.py
class MessagePolicy:
    def __init__(self, prefix: str) -> None:
        self.prefix: str = prefix.strip().lower()

    def normalized(self, text: str) -> str:
        trimmed = text.strip()
        return trimmed.lower()

    def matches(self, text: str) -> bool:
        normalized = self.normalized(text)
        return normalized.startswith(self.prefix)

    def describe(self, text: str) -> str:
        normalized = self.normalized(text)
        return self.prefix + ':' + normalized

    def same_prefix(self, text: str) -> bool:
        normalized = self.normalized(text)
        return normalized[:len(self.prefix)] == self.prefix
# File: cli.py
from src.message_policy import MessagePolicy
if __name__ == '__main__':
    policy = MessagePolicy('status')
    print(policy.normalized(' READY '), policy.matches('status ready'), policy.describe('ready'), policy.same_prefix('status now'))
```
