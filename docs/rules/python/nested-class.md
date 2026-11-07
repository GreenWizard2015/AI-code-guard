# `nested-class`

Description: Nested classes hide ownership and make dependencies harder to discover.

## Bad

```python
# File: src/service/service.py
class Service:
    class State:
        def __init__(self, value: str) -> None:
            self._value: str = value

        def normalized_label(self) -> str:
            label = self._value.strip().upper()
            if len(label) == 0:
                return "UNKNOWN"
            return label

        def word_count(self) -> int:
            word_count = 0
            for word in self.normalized_label().split():
                word_count += 1
            return word_count

        def label_length(self) -> int:
            return len("".join(self.normalized_label().split()))

    def __init__(self, initial_label: str) -> None:
        self._state: Service.State = Service.State(initial_label)

    def status_label(self) -> str:
        label = self._state.normalized_label()
        return f"Service status: {label}"

    def ready(self) -> bool:
        return self.status_label().endswith("READY")

    def status_summary(self) -> str:
        label = self.status_label()
        words = self._state.word_count()
        length = self._state.label_length()
        return f"{label} ({words} words, {length} characters)"

    def report(self) -> None:
        print(f"{self.status_summary()} | ready={self.ready()}")
# File: cli.py
from src.service.service import Service

if __name__ == "__main__":
    service = Service("ready")
    service.report()
```

**Fix:** Move the class to a focused top-level module or use composition. Dataclasses and
exception classes remain valid small-file owners.

## Good

```python
# File: src/service/service_state.py
class ServiceState:
    def __init__(self, value: str) -> None:
        self._value: str = value

    def normalized_label(self) -> str:
        label = self._value.strip().upper()
        if len(label) == 0:
            return "UNKNOWN"
        return label

    def word_count(self) -> int:
        word_count = 0
        for word in self.normalized_label().split():
            word_count += 1
        return word_count

    def label_length(self) -> int:
        return len("".join(self.normalized_label().split()))
# File: src/service/service_status.py
from src.service.service_state import ServiceState

class ServiceStatus:
    def __init__(self, initial_label: str) -> None:
        self._state: ServiceState = ServiceState(initial_label)

    def status_label(self) -> str:
        label = self._state.normalized_label()
        return f"Service status: {label}"

    def ready(self) -> bool:
        return self.status_label().endswith("READY")

    def status_summary(self) -> str:
        label = self.status_label()
        words = self._state.word_count()
        length = self._state.label_length()
        return f"{label} ({words} words, {length} characters)"

    def report(self) -> None:
        print(f"{self.status_summary()} | ready={self.ready()}")
# File: cli.py
from src.service.service_status import ServiceStatus

if __name__ == "__main__":
    service = ServiceStatus("ready")
    service.report()
```
