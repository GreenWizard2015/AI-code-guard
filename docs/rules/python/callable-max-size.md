# `callable-max-size`

Description: Detect functions and methods whose implementation is too large to remain one focused
operation.


Fix: Extract a cohesive operation or move behavior to its owning collaborator. Check callers and
preserve state ownership; do not create arbitrary forwarding helpers.

Size averages callable-body lines and executable SLOC, excluding signatures and Python docstrings.
The separate 100-significant-character limit ignores whitespace.

## Bad


```python
# File: src/content_record.py
class ContentRecord:

    def __init__(self, name: str, content: str) -> None:
        self.name: str = name
        self.content: str = content

    def word_count(self) -> int:
        return len(self.content.split())

    def describe_value(self) -> str:  # <- error
{% const descriptions = [{"term":"alpha","value":"first"},{"term":"beta","value":"second"},{"term":"gamma","value":"third"},{"term":"delta","value":"fourth"},{"term":"epsilon","value":"fifth"},{"term":"zeta","value":"sixth"},{"term":"eta","value":"seventh"}] %}
{% for item in descriptions %}
        if "{{item.term}}" in self.content:
            return "{{item.value}}"
{% endfor %}
        return "other"

    def summary(self) -> str:
        count = self.word_count()
        return f"{self.name} ({count} words)"

    def report(self) -> None:
        print(f"{self.describe_value()} | {self.summary()}")
# File: cli.py
from src.content_record import ContentRecord
if __name__ == "__main__":
    record = ContentRecord("notes.txt", "alpha beta gamma delta epsilon")
    record.report()
```

## Good


```python
# File: src/content_record.py
class ContentRecord:
    """Responsibilities: _content record state_."""

    def __init__(self, name: str, content: str) -> None:
        """Responsibilities: _record initialization_."""
        self._name: str = name
        self._content: str = content
        self._descriptions: dict[str, str] = {
            "alpha": "first",
            "beta": "second",
            "gamma": "third",
            "delta": "fourth",
            "epsilon": "fifth",
            "zeta": "sixth",
            "eta": "seventh",
        }

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        return len(self._content.split())

    def describe_value(self) -> str:
        """Responsibilities: _value description_."""
        for term, description in self._descriptions.items():
            if term in self._content:
                return description
        return "other"

    def summary(self) -> str:
        """Responsibilities: _record summary_."""
        count = self.word_count()
        return f"{self._name}: {self.describe_value()} ({count} words)"
    def report(self) -> None:
        """Responsibilities: _content record report output_."""
        print(self.summary())
# File: cli.py
from src.content_record import ContentRecord
if __name__ == "__main__":
    record = ContentRecord("notes.txt", "alpha beta gamma delta epsilon")
    record.report()
```
