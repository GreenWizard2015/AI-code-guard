# `parse-error`

Description: Fix syntax errors before relying on structural lint diagnostics.

## Bad

```python
# File: src/broken.py
def read_value( -> str:
    return "ready"
# File: src/parse_report.py
class ParseReport:
    def __init__(self, file_name: str, errors: list[str]) -> None:
        self._file_name: str = file_name
        self._errors: list[str] = errors
    def summary(self) -> str:
        lines = [self._file_name]
        for error in self._errors:
            normalized_error = error.strip()
            if normalized_error:
                lines.append(normalized_error)
        if len(self._errors) == 0:
            lines.append("clean")
        return ": ".join(lines)
    def error_count(self) -> int:
        count = 0
        for error in self._errors:
            if error.strip():
                count += 1
        return count
    def report(self) -> None:
        summary = self.summary()
        count = self.error_count()
        print(f"{summary} ({count})")
# File: cli.py
from src.parse_report import ParseReport

if __name__ == "__main__":
    report = ParseReport("broken.py", ["syntax error"])
    report.report()
```

## Good

```python
# File: src/constants.py
VALUE = "ready"
# File: src/parse_report.py
class ParseReport:
    def __init__(self, file_name: str, errors: list[str]) -> None:
        self._file_name: str = file_name
        self._errors: list[str] = errors
    def summary(self) -> str:
        lines = [self._file_name]
        for error in self._errors:
            normalized_error = error.strip()
            if normalized_error:
                lines.append(normalized_error)
        if len(self._errors) == 0:
            lines.append("clean")
        return ": ".join(lines)
    def error_count(self) -> int:
        count = 0
        for error in self._errors:
            if error.strip():
                count += 1
        return count
    def report(self) -> None:
        summary = self.summary()
        count = self.error_count()
        print(f"{summary} ({count})")
# File: cli.py
from src.parse_report import ParseReport
from src.constants import VALUE

if __name__ == "__main__":
    report = ParseReport("reader.py", [VALUE])
    report.report()
```
