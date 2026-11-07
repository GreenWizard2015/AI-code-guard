# `unused-constant`

Description: Reports a module-level constant with no production symbol usage. Remove dead
configuration or vocabulary, or add a real production consumer.

## Bad


```python
# File: src/constants.py
READ_FAILURE_MESSAGE = "request processing failed"  # <- error
# File: src/read_failure_reporter.py
class ReadFailureReporter:
    def __init__(self, source_name: str) -> None:
        self._source_name: str = source_name

    def normalized_source(self) -> str:
        trimmed_source = self._source_name.strip()
        return trimmed_source.lower()

    def message(self) -> str:
        source = self.normalized_source()
        return f"{source}: monitor ready"

    def source_context(self) -> str:
        return f"Source {self.normalized_source()}"

    def report(self) -> None:
        message = self.message()
        context = self.source_context()
        print(f"{message} | {context}")
# File: cli.py
from src.read_failure_reporter import ReadFailureReporter

if __name__ == "__main__":
    reporter = ReadFailureReporter("queue")
    reporter.report()
```

## Good


```python
# File: src/constants.py
READ_FAILURE_MESSAGE = "request processing failed"
# File: src/read_failure_reporter.py
from src.constants import READ_FAILURE_MESSAGE

class ReadFailureReporter:
    def __init__(self, source_name: str) -> None:
        self._source_name: str = source_name

    def normalized_source(self) -> str:
        trimmed_source = self._source_name.strip()
        return trimmed_source.lower()

    def message(self) -> str:
        source = self.normalized_source()
        return f"{source}: {READ_FAILURE_MESSAGE}"

    def source_context(self) -> str:
        return f"Source {self.normalized_source()}"

    def report(self) -> None:
        message = self.message()
        context = self.source_context()
        print(f"{message} | {context}")
# File: cli.py
from src.read_failure_reporter import ReadFailureReporter

if __name__ == "__main__":
    reporter = ReadFailureReporter("queue")
    reporter.report()
```
