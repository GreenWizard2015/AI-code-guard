# `property-setter`

Description: Property setters and deleters hide state transitions and weaken immutability.

```python
item.name = value
```

Fix: Return a new value or expose an explicit transition such as `with_name(value)`.

## Bad

```python
# File: src/profile.py
class Profile:
    def __init__(self, name: str) -> None:
        self._name: str = name.strip()

    @property
    def name(self) -> str:
        return self._name

    @name.setter
    def name(self, value: str) -> None:
        self._name = value.strip()  # <- error

    def name_label(self) -> str:
        return f"Profile: {self.name}"

    def name_length(self) -> int:
        return len(self.name)

    def report(self) -> None:
        label = self.name_label()
        length = self.name_length()
        print(f"{label} ({length} characters)")
# File: cli.py
from src.profile import Profile

if __name__ == "__main__":
    profile = Profile("Ada")
    profile.name = "Grace"
    profile.report()
```

## Good

```python
# File: src/profile.py
class Profile:
    def __init__(self, name: str) -> None:
        self._name: str = name.strip()

    def name_label(self) -> str:
        return f"Profile: {self._name}"

    def name_length(self) -> int:
        return len(self._name)

    def initials(self) -> str:
        parts = self._name.split()
        if len(parts) == 0:
            return "?"
        return ".".join(part[:1].upper() for part in parts)

    def profile_summary(self) -> str:
        return f"{self.name_label()} ({self.name_length()} characters; {self.initials()})"

    def report(self) -> None:
        print(self.profile_summary())
# File: cli.py
from src.profile import Profile

if __name__ == "__main__":
    profile = Profile("Grace")
    profile.report()
```
