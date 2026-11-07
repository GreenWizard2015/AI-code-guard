# `data-class-method`

Description: Keep Python dataclasses focused on state. They must not become holders of business
logic.

```python
from dataclasses import dataclass

@dataclass
class User:
    name: str

    def normalize(self) -> str:  # violation
        return self.name.strip()
```

Special methods such as `__str__` and `__post_init__` are allowed. Abstract base classes are
covered by `python-abstract-class`; use a Protocol or interface for a contract instead.


Fix: Move behavior into a normal class that owns the logic and keep the dataclass as its data
value.

## Bad

```python
# File: src/user.py
from dataclasses import dataclass

@dataclass
class User:
    name: str

    def normalize(self) -> str:
        """Responsibilities: _user name normalization_."""
        return self.name.strip()

    def report(self) -> None:
        """Responsibilities: _user report output_."""
        print(f"User: {self.normalize()}")
# File: cli.py
from src.user import User

if __name__ == "__main__":
    user = User(" Ada ")
    user.report()
```

## Good

```python
# File: src/user.py
from dataclasses import dataclass

@dataclass
class User:
    """Responsibilities: _user data value_."""
    name: str
# File: src/user_profile.py
class UserProfile:
    """Responsibilities: _user profile behavior_."""

    def __init__(self, name: str) -> None:
        """Responsibilities: _profile initialization_."""
        self._name: str = name

    def normalized_name(self) -> str:
        """Responsibilities: _profile name normalization_."""
        return " ".join(self._name.split())

    def initials(self) -> str:
        """Responsibilities: _profile initials_."""
        words = self._name.split()
        if len(words) == 0:
            return "?"
        return "".join(word[:1].upper() for word in words)

    def name_length_label(self) -> str:
        """Responsibilities: _profile name length_."""
        normalized_name = " ".join(self._name.split())
        return f"{len(normalized_name)} characters"

    def report(self) -> None:
        """Responsibilities: _profile report output_."""
        print(f"User: {self.normalized_name()} | {self.initials()} | {self.name_length_label()}")
# File: cli.py
from src.user import User
from src.user_profile import UserProfile

if __name__ == "__main__":
    user = User(" Ada ")
    profile = UserProfile(user.name)
    profile.report()
```
