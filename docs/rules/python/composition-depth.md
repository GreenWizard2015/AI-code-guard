# `composition-depth`

Description: Deep wrapper chains couple behavior to too many ownership layers.

```text
A -> B -> C -> D
```


Fix: Remove pass-through layers and keep only classes with their own state or lifecycle.

## Bad


```python
{% const layers = [{"name":"RequestCoordinator","next":"PolicyService","path":"request_coordinator","dependency_path":"policy_service","role":"request coordinator"},{"name":"PolicyService","next":"RecordStore","path":"policy_service","dependency_path":"record_store","role":"record store"},{"name":"RecordStore","next":"RecordParser","path":"record_store","dependency_path":"record_parser","role":"record store"},{"name":"RecordParser","next":"RecordValidator","path":"record_parser","dependency_path":"record_validator","role":"record parser"}] %}
# File: src/request_pipeline.py
{%for layer in layers %}
class {{layer.name}}:

    def __init__(self) -> None:
        self._dependency: {{layer.next}} = {{layer.next}}()

    def run(self) -> str:
        return self._dependency.run()  # <- error

    def report(self) -> None:
        print(self.run())
{% endfor %}
class RecordValidator:

    def __init__(self) -> None:
        self._state: str = "ready"

    def run(self) -> str:
        return self._state
# File: cli.py
from src.request_pipeline import RequestCoordinator

if __name__ == "__main__":
    coordinator = RequestCoordinator()
    coordinator.report()
```

## Good


```python
# File: src/request.py
class Request:
    """Responsibilities: _request state_."""

    def __init__(self) -> None:
        """Responsibilities: _request initialization_."""
        self._state: str = "ready"

    def ready(self) -> bool:
        """Responsibilities: _request readiness classification_."""
        return self._state.strip() == "ready"

    def status_label(self) -> str:
        """Responsibilities: _request status label_."""
        if self.ready():
            return "Ready"
        return "Pending"

    def state_length(self) -> int:
        """Responsibilities: _request state length_."""
        return len(self._state.strip())

    def summary(self) -> str:
        """Responsibilities: _request summary_."""
        label = self.status_label()
        length = self.state_length()
        return f"{label} ({length} characters)"

    def report(self) -> None:
        """Responsibilities: _request report output_."""
        print(self.summary())
# File: cli.py
from src.request import Request

if __name__ == "__main__":
    request = Request()
    request.report()
```
