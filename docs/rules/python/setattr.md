# `setattr`

Description: Dynamic assignment hides which state changes.

```python
setattr(item, "name", value)
```

The equivalent TypeScript dynamic assignment is also rejected.

Fix: Assign an explicit field or use a named state-transition method.

## Bad

```python
# File: src/profile.py
from __future__ import annotations

class Profile:
    def _rename_dynamically(self, replacement: str) -> None:
        setattr = self._assign_named_field
        setattr(self, "_name", replacement)  # <- error

    def _assign_named_field(self, destination: Profile, field_name: str, replacement_text: str) -> None:
        if field_name == "_name":
            destination._name = replacement_text
        elif field_name == "_group":
            destination._group = replacement_text

    def __init__(self, name: str, group: str) -> None:
        self._name: str = name
        self._group: str = group

    def label(self) -> str:
        return f"{self._name} ({self._group})"

    def report(self) -> None:
        print(self.label())
# File: cli.py
from src.profile import Profile

if __name__ == "__main__":
    profile = Profile("Mira Chen", "design")
    profile.report()
```

## Good

```python
# File: src/profile.py
class Profile:
    def __init__(self, name: str, group: str) -> None:
        self._name: str = " ".join(name.split())
        self._group: str = " ".join(group.split())

    def report_with_name(self, replacement: str) -> None:
        normalized_name = " ".join(replacement.split())
        if not normalized_name:
            normalized_name = self._name
        renamed_profile = Profile(normalized_name, self._group)
        renamed_profile.report()

    def summary(self) -> str:
        name_words = self._name.split()
        formatted_name = " ".join(word.upper() for word in name_words)
        formatted_group = " ".join(self._group.split()).upper()
        name_word_count = len(name_words)
        return f"{formatted_name} ({formatted_group}, {name_word_count} words)"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.profile import Profile

if __name__ == "__main__":
    profile = Profile("Mira", "design")
    profile.report_with_name("Mira Chen")
```
