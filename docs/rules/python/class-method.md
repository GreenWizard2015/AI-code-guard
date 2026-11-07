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
# File: src/token.py
class Token:
    """Responsibilities: _token value representation_."""

    def __init__(self, value: str) -> None:
        """Responsibilities: _token initialization_."""
        self.value: str = value

    @classmethod
    def from_text(cls, value: str) -> "Token":
        """Responsibilities: _text-based token construction_."""
        return cls(value.strip())

    def normalized(self) -> str:
        """Responsibilities: _token normalization_."""
        return self.value.strip().lower()

    def label(self) -> str:
        """Responsibilities: _token label formatting_."""
        return f"Token: {self.normalized()}"

    def report(self) -> None:
        """Responsibilities: _token report output_."""
        print(self.label())
# File: cli.py
from src.token import Token

if __name__ == "__main__":
    token = Token.from_text(" Ready ")
    token.report()
```

## Good

```python
# File: src/token.py
class Token:
    """Responsibilities: _token value representation_."""

    def __init__(self, value: str) -> None:
        """Responsibilities: _token initialization_."""
        self._value: str = value

    def normalized(self) -> str:
        """Responsibilities: _token normalization_."""
        trimmed = self._value.strip()
        return trimmed.lower()

    def present(self) -> bool:
        """Responsibilities: _token presence_."""
        normalized = self.normalized()
        return len(normalized) > 0

    def starts_with(self, prefix: str) -> bool:
        """Responsibilities: _token prefix matching_."""
        normalized_prefix = prefix.strip().lower()
        return self.normalized().startswith(normalized_prefix)

    def same_value(self, value: str) -> bool:
        """Responsibilities: _token value comparison_."""
        return self.normalized() == value.strip().lower()
    def report(self) -> None:
        """Responsibilities: _token report output_."""
        print(f"{self.normalized()} {self.present()} {self.starts_with('re')} {self.same_value('ready')}")
# File: cli.py
from src.token import Token

if __name__ == '__main__':
    token = Token(' Ready ')
    token.report()
```
