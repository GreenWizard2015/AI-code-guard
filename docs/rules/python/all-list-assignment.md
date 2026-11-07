# Python `__all__` Literal List

Description: Declare exports only with one direct assignment to a list of string literals. Do not annotate, concatenate, alias, or mutate `__all__`.

## Bad

```python
# File: src/status.py
__all__ = ["Status"]
__all__ += [__name__]  # <- error

class Status:
    """Responsibilities: _status value and presentation_."""

    def __init__(self, value: str, source: str) -> None:
        """Responsibilities: _status initialization_."""
        self._value: str = value
        self._source: str = source

    def normalized_value(self) -> str:
        """Responsibilities: _status normalization_."""
        trimmed_value = self._value.strip()
        return trimmed_value.lower()

    def word_count(self) -> int:
        """Responsibilities: _status word counting_."""
        words = self._value.strip().split()
        count = 0
        for word in words:
            if len(word) > 0:
                count += 1
        return count

    def character_count(self) -> int:
        """Responsibilities: _status character counting_."""
        return len(self._value.strip())

    def label(self, prefix: str) -> str:
        """Responsibilities: _status label formatting_."""
        clean_prefix = prefix.strip()
        normalized_value = self.normalized_value()
        source_label = self._source.strip().title()
        return f"{clean_prefix} {source_label}: {normalized_value}"

    def summary(self) -> str:
        """Responsibilities: _status summary composition_."""
        label = self.label("State")
        words = self.word_count()
        characters = self.character_count()
        return f"{label} ({words} words, {characters} characters)"

    def report(self) -> None:
        """Responsibilities: _status report output_."""
        summary = self.summary()
        print(summary)
# File: cli.py
from src.status import Status

if __name__ == "__main__":
    status = Status("ready", "catalog")
    status.report()
```

## Good

```python
# File: src/status.py
__all__ = ["Status"]

class Status:
    """Responsibilities: _status value and presentation_."""

    def __init__(self, value: str, source: str) -> None:
        """Responsibilities: _status initialization_."""
        self._value: str = value
        self._source: str = source

    def normalized_value(self) -> str:
        """Responsibilities: _status normalization_."""
        trimmed_value = self._value.strip()
        return trimmed_value.lower()

    def word_count(self) -> int:
        """Responsibilities: _status word counting_."""
        words = self._value.strip().split()
        count = 0
        for word in words:
            if len(word) > 0:
                count += 1
        return count

    def character_count(self) -> int:
        """Responsibilities: _status character counting_."""
        return len(self._value.strip())

    def label(self, prefix: str) -> str:
        """Responsibilities: _status label formatting_."""
        clean_prefix = prefix.strip()
        normalized_value = self.normalized_value()
        source_label = self._source.strip().title()
        return f"{clean_prefix} {source_label}: {normalized_value}"

    def summary(self) -> str:
        """Responsibilities: _status summary composition_."""
        label = self.label("State")
        words = self.word_count()
        characters = self.character_count()
        return f"{label} ({words} words, {characters} characters)"

    def report(self) -> None:
        """Responsibilities: _status report output_."""
        summary = self.summary()
        print(summary)
# File: cli.py
from src.status import Status

if __name__ == "__main__":
    status = Status("ready", "catalog")
    status.report()
```
