# `python-type-cast`

Description: `typing.cast` only changes what the type checker believes; it does not check or convert the value at runtime.

```python
result = cast(User, value)
```

Narrow with a runtime check or correct the declared type instead.

## Bad

```python
# File: src/user_reader.py
from typing import cast

def read_user(value: object) -> str:
    return cast(str, value)  # <- error

def user_label(value: object) -> str:
    return f"User: {read_user(value)}"

def report_user_label(value: object) -> None:
    print(user_label(value))
# File: cli.py
from src.user_reader import report_user_label

if __name__ == "__main__":
    report_user_label("ready")
```

## Good

```python
# File: src/user_profile.py
class UserProfile:
    def __init__(self, value: str) -> None:
        self._value: str = value

    def user_label(self) -> str:
        return f"User: {self._value}"

    def normalized_label(self) -> str:
        return self.user_label().strip().lower()

    def label_length(self) -> int:
        return len(self.user_label())

    def populated(self) -> bool:
        return len(self._value.strip()) > 0

    def report(self) -> None:
        normalized = self.normalized_label()
        length = self.label_length()
        present = self.populated()
        print(f"{normalized} ({length}; present={present})")
# File: cli.py
from src.user_profile import UserProfile

if __name__ == "__main__":
    profile = UserProfile("ready")
    profile.report()
```
