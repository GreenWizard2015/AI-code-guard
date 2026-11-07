# `object-setattr`

Description: `object.__setattr__` bypasses immutability and the normal object contract.

```python
object.__setattr__(self, "value", value)
```

Fix: Assign during construction or expose an explicit transition; do not bypass the contract.

## Bad

```python
# File: src/record.py
class Record:
    def __init__(self, value: str) -> None:
        self.value: str = value

    def update_field(self, name: str, value: str) -> None:
        object.__setattr__(self, name, value)  # <- error

    def field_value(self) -> str:
        return self.value

    def field_length(self) -> int:
        return len(self.field_value())

    def summary(self) -> str:
        self.update_field("value", "revised")
        return f"{self.field_value()} ({self.field_length()} characters)"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.record import Record

if __name__ == "__main__":
    record = Record("draft")
    record.report()
```

## Good

```python
# File: src/token.py
class Token:
    def __init__(self, value: str) -> None:
        self._value: str = value

    def normalized(self) -> str:
        trimmed = self._value.strip()
        return trimmed.lower()

    def present(self) -> bool:
        normalized = self.normalized()
        return len(normalized) > 0

    def starts_with(self, prefix: str) -> bool:
        normalized_prefix = prefix.strip().lower()
        return self.normalized().startswith(normalized_prefix)

    def same_value(self, value: str) -> bool:
        cleaned_value = value.strip().lower()
        return self.normalized() == cleaned_value

    def summary(self) -> str:
        prefix_match = self.starts_with("re")
        value_match = self.same_value("ready")
        return f"{self.normalized()} ({self.present()}; {prefix_match}; {value_match})"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.token import Token

if __name__ == "__main__":
    token = Token(" Ready ")
    token.report()
```
