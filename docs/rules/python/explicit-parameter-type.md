# `explicit-parameter-type`

Description: Require an explicit type for every Python input parameter. This includes
positional-only, keyword-only, `*args`, `**kwargs`, and callback parameters.
`self` and `cls` are the only implicit receiver exceptions because annotating
them requires a forward reference to the containing class.

```python
# Bad
def render(template, *, pretty=False):
    ...

# Good
def render(template: Template, *, pretty: bool = False) -> str:
    ...

def merge(*parts: str, **options: str) -> str:
    ...
```

Use a meaningful type instead of `Any` unless the boundary genuinely accepts
unknown values. Isolate dynamically typed external data in an adapter.

## Bad

```python
# File: src/text_normalizer.py
class TextNormalizer:
    def __init__(self, empty_marker: str) -> None:
        self.empty_marker: str = empty_marker
    def normalize(self, value) -> str:  # <- error
        normalized = value.strip().lower()
        if len(normalized) == 0: return self.empty_marker
        return normalized

    def empty_status(self, value: str) -> bool:
        normalized = self.normalize(value)
        return len(normalized) == len(self.empty_marker)

    def word_count(self, value: str) -> int:
        normalized = self.normalize(value)
        if len(normalized) == 0: return 0
        words = normalized.split()
        return len(words)
    def report(self, source: str) -> None:
        normalized_text = self.normalize(source)
        empty_result = self.empty_status(source)
        word_total = self.word_count(source)
        print(f"{normalized_text} | {empty_result} | {word_total}")
# File: src/cli.py
from src.text_normalizer import TextNormalizer
if __name__ == "__main__":
    normalizer = TextNormalizer("empty")
    normalizer.report(" ready ")
```

## Good

```python
# File: src/text_normalizer.py
class TextNormalizer:
    """Responsibilities: _text normalization and classification_."""
    def __init__(self, empty_marker: str) -> None:
        """Responsibilities: _normalizer state initialization_."""
        self._empty_marker: str = empty_marker
    def normalize(self, value: str) -> str:
        """Responsibilities: _text normalization_."""
        normalized = value.strip().lower()
        if len(normalized) == 0: return self._empty_marker
        return normalized

    def empty_status(self, candidate: str) -> bool:
        """Responsibilities: _normalized text emptiness classification_."""
        normalized = self.normalize(candidate)
        return len(normalized) == len(self._empty_marker)

    def word_count(self, source: str) -> int:
        """Responsibilities: _normalized word counting_."""
        normalized = self.normalize(source)
        if len(normalized) == 0: return 0
        words = normalized.split()
        return len(words)
    def report(self, source: str) -> None:
        """Responsibilities: _normalization report output_."""
        normalized_text = self.normalize(source)
        empty_result = self.empty_status(source)
        word_total = self.word_count(source)
        print(f"{normalized_text} | {empty_result} | {word_total}")
# File: src/cli.py
from src.text_normalizer import TextNormalizer
if __name__ == "__main__":
    normalizer = TextNormalizer("empty")
    normalizer.report(" ready ")
```
