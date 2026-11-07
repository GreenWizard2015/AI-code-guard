# `dynamic-type`

Description: Runtime-built project classes hide their field and behavior contracts. Declare
normal domain classes with explicit state and operations instead.

## Bad


```python
# File: src/model_reporter.py
class ModelReporter:
    def __init__(self, section: str, subject: str) -> None:
        self.section: str = section
        self.subject: str = subject

    def report_model(self, model_type: type) -> None:
        is_runtime_class = isinstance(model_type, type)
        section_label = self.section.upper()
        subject_label = self.subject.lower()
        print(f"{section_label}: {subject_label} runtime class={is_runtime_class}")
# File: src/cli.py
from src.model_reporter import ModelReporter

if __name__ == "__main__":
    runtime_model = type("RuntimeModel", (), {})
    reporter = ModelReporter("runtime", "model")
    reporter.report_model(runtime_model)
```

## Good


```python
# File: src/status_model.py
class StatusModel:
    """Hold an explicit status and its descriptive detail."""

    def __init__(self, status: str, detail: str) -> None:
        self._status: str = status
        self._detail: str = detail

    def normalized_status(self) -> str:
        """Normalize the stored status label."""
        trimmed_status = self._status.strip()
        return trimmed_status.lower()

    def summary(self) -> str:
        """Compose the status and detail for a caller."""
        status_label = self.normalized_status().upper()
        detail_label = self._detail.strip()
        return f"{status_label}: {detail_label}"

    def detail_length(self) -> int:
        """Return the visible detail length."""
        normalized_detail = self._detail.strip()
        return len(normalized_detail)

    def report(self) -> None:
        """Print the model's observable status report."""
        summary = self.summary()
        normalized_status = self.normalized_status()
        size = self.detail_length()
        print(f"{summary} ({normalized_status}, {size} characters)")
# File: src/cli.py
from src.status_model import StatusModel

if __name__ == "__main__":
    model = StatusModel("ready", "request accepted")
    model.report()
```
