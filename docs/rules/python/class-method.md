# `class-method`

Description: Class-level factories hide construction policy.

```python
class Token:
    token: str

    def __init__(self, token: str):
        self.token = token

    @classmethod
    def from_text(cls, text: str) -> "Token": ...
```


Fix: Use a named module factory or an injected factory object.

## Bad

```python
from __future__ import annotations

class Token:
    def __init__(self, value: str) -> None:
        self.value: str = value

    @classmethod
    def from_text(cls, value: str) -> Token:
        return cls(value.strip())
```

## Good

```python
# File: src/token.py
class Token:
    def __init__(self, value: str) -> None:
        self.value: str = value

    def normalized(self) -> str:
        trimmed = self.value.strip()
        return trimmed.lower()

    def present(self) -> bool:
        normalized = self.normalized()
        return len(normalized) > 0

    def starts_with(self, prefix: str) -> bool:
        normalized_prefix = prefix.strip().lower()
        return self.normalized().startswith(normalized_prefix)

    def same_value(self, value: str) -> bool:
        return self.normalized() == value.strip().lower()
# File: cli.py
from src.token import Token
if __name__ == '__main__':
    token = Token(' Ready ')
    print(token.normalized(), token.present(), token.starts_with('re'), token.same_value('ready'))
```
