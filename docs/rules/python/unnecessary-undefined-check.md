# `unnecessary-undefined-check`

Description: Detect a condition that checks a required field for an absent value.

**Bad:**

```python
class Parsed:
    attribute_accesses: list[str]

def has_attributes(parsed: Parsed) -> bool:
    return parsed.attribute_accesses is None
```

Fix: Remove the check when the field is required.

The TypeScript implementation uses AST declarations and reports only property accesses whose
declared field is required. It also reports optional chaining such as
`parsed?.attribute_accesses` when both the receiver and the field are required.

The Python implementation uses the Python AST and local class annotations. It recognizes
`is None`, `is not None`, `== None`, and `!= None` for fields declared without `Optional`,
`Union[..., None]`, or `| None`.

Unknown declarations and nullable annotations are intentionally skipped.

## Bad

```python
# File: src/parsed_value.py
from __future__ import annotations

class ParsedValue:
    _attribute_accesses: list[str]

    def __init__(self, attribute_accesses: list[str]) -> None:
        self._attribute_accesses: list[str] = attribute_accesses

    def attribute_state(self, parsed: ParsedValue) -> str:
        if parsed._attribute_accesses is None:  # <- error
            return "missing"
        return "available"

    def attribute_count(self) -> int:
        return len(self._attribute_accesses)

    def contains_attribute(self, candidate_name: str) -> bool:
        for attribute in self._attribute_accesses:
            if attribute == candidate_name:
                return True
        return False

    def attribute_preview(self) -> str:
        labels: list[str] = []
        for attribute in self._attribute_accesses:
            labels.append(attribute.strip().upper())
        return ", ".join(labels)

    def summary(self) -> str:
        state = self.attribute_state(self)
        count = self.attribute_count()
        preview = self.attribute_preview()
        includes_name = self.contains_attribute("name")
        return f"{state}: {count} attributes ({preview}; name={includes_name})"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.parsed_value import ParsedValue

if __name__ == "__main__":
    parsed = ParsedValue(["name"])
    parsed.report()
```

## Good

```python
from __future__ import annotations

# File: src/parsed_value.py
class ParsedValue:
    _attribute_accesses: list[str]

    def __init__(self, attribute_accesses: list[str]) -> None:
        self._attribute_accesses: list[str] = attribute_accesses

    def attribute_state(self) -> str:
        if len(self._attribute_accesses) > 0:
            return "available"
        return "empty"

    def attribute_count(self) -> int:
        return len(self._attribute_accesses)

    def contains_attribute(self, candidate_name: str) -> bool:
        for attribute in self._attribute_accesses:
            if attribute == candidate_name:
                return True
        return False

    def attribute_preview(self) -> str:
        labels: list[str] = []
        for attribute in self._attribute_accesses:
            labels.append(attribute.strip().upper())
        return ", ".join(labels)

    def summary(self) -> str:
        state = self.attribute_state()
        count = self.attribute_count()
        preview = self.attribute_preview()
        includes_name = self.contains_attribute("name")
        return f"{state}: {count} attributes ({preview}; name={includes_name})"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.parsed_value import ParsedValue

if __name__ == "__main__":
    parsed = ParsedValue(["name"])
    parsed.report()
```
