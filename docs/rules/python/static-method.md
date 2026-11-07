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
# File: src/parser.py
class Parser:
    def __init__(self, prefix: str) -> None:
        self.prefix: str = prefix

    @staticmethod
    def parse(text: str) -> str:
        return text.strip().lower()

    def report(self, text: str) -> None:
        print(f"{self.prefix}: {self.parse(text)}")
# File: src/cli.py
from src.parser import Parser

if __name__ == "__main__":
    parser = Parser("status")
    parser.report(" READY ")
```

## Good

```python
# File: src/message_policy.py
class MessagePolicy:
    def _normalized(self, text: str) -> str:
        trimmed = text.strip()
        normalized = trimmed.lower()
        return normalized

    def __init__(self, prefix: str) -> None:
        normalized_prefix = prefix.strip().lower()
        self._prefix: str = normalized_prefix

    def matches(self, candidate: str) -> bool:
        normalized = self._normalized(candidate)
        matches = normalized.startswith(self._prefix)
        if not matches:
            return False
        return True

    def describe(self, message: str) -> str:
        normalized = self._normalized(message)
        description = self._prefix + ':' + normalized
        return description

    def same_prefix(self, value: str) -> bool:
        normalized = self._normalized(value)
        prefix = normalized[:len(self._prefix)]
        return prefix == self._prefix
    def report(self, message: str, prefix_probe: str) -> None:
        matched = self.matches(message)
        description = self.describe(message)
        shares_prefix = self.same_prefix(prefix_probe)
        print(matched, description, shares_prefix)
# File: src/cli.py
from src.message_policy import MessagePolicy
if __name__ == '__main__':
    policy = MessagePolicy('status')
    policy.report('status ready', 'status now')
```
