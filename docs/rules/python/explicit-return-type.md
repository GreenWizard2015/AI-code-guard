# `explicit-return-type`

Description: Declare the result type of every named callable explicitly.

## Bad

```python
# File: src/read_value.py
class ReadValue:
    """Responsibilities: _text value state_."""

    def __init__(self, raw_value: str) -> None:
        """Responsibilities: _value initialization_."""
        self._raw_value: str = raw_value

    def normalized_value(self) -> str:
        """Responsibilities: _value normalization_."""
        trimmed = self._raw_value.strip()
        words = trimmed.split()
        joined = " ".join(words)
        normalized = joined.lower()
        return normalized

    def word_count(self) -> int:
        """Responsibilities: _normalized word counting_."""
        words = self.normalized_value().split()
        count = 0
        for word in words:
            if word:
                count += 1
        return count

    def render_value(self):  # <- error
        """Responsibilities: _value reading_."""
        value = self.normalized_value()
        count = self.word_count()
        rendered = f"{value} ({count})"
        print(rendered)
        return rendered
# File: cli.py
from src.read_value import ReadValue

if __name__ == "__main__":
    value = ReadValue("ready")
    value.render_value()
```

## Good

```python
# File: src/read_value.py
class ReadValue:
    """Responsibilities: _text value state_."""

    def __init__(self, raw_value: str) -> None:
        """Responsibilities: _value initialization_."""
        self._raw_value: str = raw_value

    def normalized_value(self) -> str:
        """Responsibilities: _value normalization_."""
        trimmed = self._raw_value.strip()
        words = trimmed.split()
        joined = " ".join(words)
        normalized = joined.lower()
        return normalized

    def word_count(self) -> int:
        """Responsibilities: _normalized word counting_."""
        words = self.normalized_value().split()
        count = 0
        for word in words:
            if word:
                count += 1
        return count

    def render_value(self) -> str:
        """Responsibilities: _value reading_."""
        value = self.normalized_value()
        count = self.word_count()
        rendered = f"{value} ({count})"
        print(rendered)
        return rendered
# File: cli.py
from src.read_value import ReadValue

if __name__ == "__main__":
    value = ReadValue("ready")
    value.render_value()
```
