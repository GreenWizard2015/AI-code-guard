# callable-nesting-depth

Description: Problem: callable control-flow nesting is too deep.

Hint: Split nested control flow into focused predicates or operations. Do not:
hide the nesting in arbitrary wrappers.

The rule counts nested `if`, loops, `try`, `with`, `match`, and `switch`
containers inside one callable. Nested callable bodies are separate scopes and
do not increase the enclosing callable's depth. The same metric is collected
for TypeScript and Python callables, including methods.

## Bad


```python
# File: src/content_source.py
class ContentSource:
    def __init__(self, enabled: bool, values: list[str], visible: list[bool]) -> None:
        self._enabled: bool = enabled
        self._values: list[str] = values
        self._visible: list[bool] = visible

    def read_ready_value(self) -> str:
        if self._enabled:
            for index, value in enumerate(self._values):
                if self._visible[index]:
                    try:
                        return value
                    except ValueError:
                        continue
        return ""

    def report(self) -> None:
        print(f"Ready value: {self.read_ready_value()}")
# File: cli.py
from src.content_source import ContentSource

if __name__ == "__main__":
    source = ContentSource(True, ["ready"], [True])
    source.report()
```

## Good


```python
# File: src/content_source/content_source.py
class ContentSource:
    """Responsibilities: _content source state_."""

    def __init__(self, content: str, path: str) -> None:
        """Responsibilities: _source initialization_."""
        self._content: str = content
        self._path: str = path

    def value_when_ready(self) -> str:
        """Responsibilities: _ready value selection_."""
        normalized_content = self._content.strip()
        if len(normalized_content) == 0:
            return ""
        return normalized_content

    def file_name(self) -> str:
        """Responsibilities: _file label composition_."""
        separator = self._path.rfind("/")
        return self._path[separator + 1:]

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        normalized_content = self._content.strip()
        words = normalized_content.split()
        return len(words)

    def summary(self) -> str:
        """Responsibilities: _source summary_."""
        count = self.word_count()
        return f"{self.file_name()} ({count} words)"

    def report(self) -> None:
        """Responsibilities: _source report output_."""
        print(f"{self.value_when_ready()} | {self.summary()}")
# File: cli.py
from src.content_source.content_source import ContentSource

if __name__ == "__main__":
    source = ContentSource("  ready value  ", "notes.txt")
    source.report()
```
