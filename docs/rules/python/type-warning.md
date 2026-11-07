# `type-warning`

Description: Give every Python field a concrete value type. Fields retain state across method
calls, so their declared contract must describe the values they store.

## Bad

```python
# File: src/text_value.py
from typing import Any

class TextValue:
    value: Any

    def __init__(self, value: str) -> None:
        self.value = value

    def normalized_text(self) -> str:
        raw_text = str(self.value).strip()
        if not raw_text:
            return ""
        words = raw_text.split()
        normalized_words: list[str] = []
        for word in words:
            if word:
                normalized_words.append(word)
        return " ".join(normalized_words)

    def ready(self) -> bool:
        normalized = self.normalized_text()
        if not normalized:
            return False
        return normalized.lower() == "ready"

    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        normalized = self.normalized_text()
        if not clean_prefix:
            return normalized
        return f"{clean_prefix}: {normalized}"

    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        if not normalized_fragment:
            return False
        return normalized_fragment in self.normalized_text().lower()

    def report(self) -> None:
        fields = [
            self.normalized_text(),
            str(self.ready()),
            self.label("State"),
            str(self.contains("ead")),
        ]
        print(" | ".join(fields))

# File: cli.py
from src.text_value import TextValue

if __name__ == "__main__":
    value = TextValue("ready")
    value.report()
```

## Good

```python
# File: src/text_value.py
class TextValue:
    _value: str

    def __init__(self, value: str) -> None:
        self._value = value

    def normalized_text(self) -> str:
        raw_text = self._value.strip()
        if not raw_text:
            return ""
        words = raw_text.split()
        normalized_words: list[str] = []
        for word in words:
            if word:
                normalized_words.append(word)
        return " ".join(normalized_words)

    def ready(self) -> bool:
        normalized = self.normalized_text()
        if not normalized:
            return False
        return normalized.lower() == "ready"

    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        normalized = self.normalized_text()
        if not clean_prefix:
            return normalized
        return f"{clean_prefix}: {normalized}"

    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        if not normalized_fragment:
            return False
        return normalized_fragment in self.normalized_text().lower()

    def report(self) -> None:
        fields = [
            self.normalized_text(),
            str(self.ready()),
            self.label("State"),
            str(self.contains("ead")),
        ]
        print(" | ".join(fields))

# File: cli.py
from src.text_value import TextValue

if __name__ == "__main__":
    value = TextValue("ready")
    value.report()
```
