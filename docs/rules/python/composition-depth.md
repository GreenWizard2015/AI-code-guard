# `composition-depth`

Description: Deep wrapper chains couple behavior to too many ownership layers.

```text
A -> B -> C -> D
```


Fix: Remove pass-through layers and keep only classes with their own state or lifecycle.

## Bad


```python
{% const layers = [{"name":"RequestCoordinator","next":"PolicyService","path":"request_coordinator","dependency_path":"policy_service","role":"request coordinator"},{"name":"PolicyService","next":"RecordStore","path":"policy_service","dependency_path":"record_store","role":"policy service"},{"name":"RecordStore","next":"RecordParser","path":"record_store","dependency_path":"record_parser","role":"record store"}] %}
{%for layer in layers %}
# File: src/{{layer.path}}.py
from src.{{layer.dependency_path}} import {{layer.next}}

class {{layer.name}}:

    def __init__(self) -> None:
        self.dependency: {{layer.next}} = {{layer.next}}()

    def run(self) -> str:
        return self.dependency.run()  # <- error
{% endfor %}
# File: src/record_parser.py
class RecordParser:

    def __init__(self) -> None:
        self.state: str = "ready"

    def run(self) -> str:
        return self.state
```

## Good


```python
# File: src/request.py
class Request:
    """Responsibilities: _request state_."""

    def __init__(self) -> None:
        """Responsibilities: _request initialization_."""
        self.state: str = "ready"

    def run(self) -> str:
        """Responsibilities: _request state access_."""
        state = self.state.strip()
        if len(state) == 0:
            return "Pending"
        return state

    def ready(self) -> bool:
        """Responsibilities: _request readiness classification_."""
        return self.state.strip() == "ready"

    def status_label(self) -> str:
        """Responsibilities: _request status label_."""
        if self.ready():
            return "Ready"
        return "Pending"

    def state_length(self) -> int:
        """Responsibilities: _request state length_."""
        return len(self.state.strip())

    def summary(self) -> str:
        """Responsibilities: _request summary_."""
        label = self.status_label()
        length = self.state_length()
        return f"{label} ({length} characters)"
# File: cli.py
from src.request import Request

if __name__ == "__main__":
    request = Request()
    print(request.run(), request.ready(), request.status_label(), request.state_length(), request.summary())
```
