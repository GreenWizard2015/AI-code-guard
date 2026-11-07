# `nullable-domain-type`

Description: Do not use `null`, `undefined`, `None`, `Optional`, `Any`, `unknown`, `void`,
or `never` at a field, parameter, or return boundary. Model meaningful absence
with an explicit domain contract instead of a nullable value.

## Bad


```python
# File: src/label_text.py
class LabelText:
    def __init__(self, value: str | None) -> None:
        self.value: str | None = value
    def normalized_text(self) -> str:
        if self.value is None:
            return "unavailable"
        trimmed = self.value.strip()
        if not trimmed:
            return "(empty)"
        words = trimmed.split()
        return " ".join(words)
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        text = self.normalized_text()
        if not clean_prefix:
            return text
        return f"{clean_prefix}: {text}"
    def report(self) -> str:
        output = self.label("Label")
        print(output)
        return output

# File: cli.py
from src.label_text import LabelText

if __name__ == "__main__":
    label = LabelText(None)
    label.report()
```

If absence is a real state, define an interface or protocol for the shared
behavior and distinct classes for each state. Keep the serialized boundary
representation local to the adapter that communicates with an external system.

## Good


```python
# File: src/label_text.py
class LabelText:
    def __init__(self, value: str) -> None:
        self._value: str = value

    def normalized_text(self) -> str:
        trimmed = self._value.strip()
        if not trimmed:
            return "(empty)"
        words = trimmed.split()
        return " ".join(words)

    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        text = self.normalized_text()
        if not clean_prefix:
            return text
        return f"{clean_prefix}: {text}"

    def report(self) -> str:
        output = self.label("Label")
        print(output)
        return output

# File: cli.py
from src.label_text import LabelText

if __name__ == "__main__":
    label = LabelText("ready")
    label.report()
```
