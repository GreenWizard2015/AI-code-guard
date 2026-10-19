# `type-warning`

Description: Give every Python field a concrete value type. Fields retain state across method
calls, so their declared contract must describe the values they store.

## Bad

```python
class TextValue:
    value: Any

    def __init__(self, value: str) -> None:
        self.value = value
```

## Good

```python
from dataclasses import dataclass

@dataclass
class TextValue:
    value: str

# File: cli.py
from text_value import TextValue

if __name__ == "__main__":
    value = TextValue("ready")
    print(value.value)
```
