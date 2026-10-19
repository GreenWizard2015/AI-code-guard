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
def read_ready_value(source: Source) -> str:
    if source.enabled:
        for item in source.items:
            if item.visible:
                try:
                    return item.value
                except ValueError:
                    continue
    return ""
```

## Good


```python
# File: src/content_source/content_source.py
class ContentSource:
    """Responsibilities: _content source state_."""

    def __init__(self, content: str, path: str) -> None:
        """Responsibilities: _source initialization_."""
        self.content: str = content
        self.path: str = path

    def value_when_ready(self) -> str:
        """Responsibilities: _ready value selection_."""
        normalized_content = self.content.strip()
        if len(normalized_content) == 0:
            return ""
        return normalized_content

    def file_name(self) -> str:
        """Responsibilities: _file label composition_."""
        separator = self.path.rfind("/")
        return self.path[separator + 1:]

    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        normalized_content = self.content.strip()
        words = normalized_content.split()
        return len(words)

    def summary(self) -> str:
        """Responsibilities: _source summary_."""
        count = self.word_count()
        return f"{self.file_name()} ({count} words)"
# File: cli.py
from content_source.content_source import ContentSource

if __name__ == "__main__":
    source = ContentSource("  ready value  ", "notes.txt")
    ready_value = source.value_when_ready()
    label = source.file_name()
    count = source.word_count()
    summary = source.summary()
    print(f"{ready_value} {label} {count} {summary}")
```
