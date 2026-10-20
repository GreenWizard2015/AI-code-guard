# `object-setattr`

Description: `object.__setattr__` bypasses immutability and the normal object contract.

```python
object.__setattr__(self, "value", value)
```


Fix: Assign during construction or expose an explicit transition; do not bypass the contract.

## Bad

```python
class Record:
    def update_field(self, name: str, value: str) -> None:
        super().__setattr__(name, value)  # <- error
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
