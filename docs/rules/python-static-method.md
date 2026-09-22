# `python-static-method`

**Purpose:** A Python static helper with no instance state is usually a module function.

```py
class Parser:
    parser_name: str

    def __init__(self, parser_name: str):
        self.parser_name = parser_name

    @staticmethod
    def parse(text: str) -> Result:
        if not text:
            raise ValueError('text is required')
        result = parse_text(text)
        if result.error_count > 0:
            raise ValueError('text is invalid')
        return result
```

**Fix:** Move it to `parse(text: str) -> Result` with explicit dependencies.
