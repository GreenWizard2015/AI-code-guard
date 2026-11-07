# `unused-public-field`

Description: Reports a public implementation field with no production read or access. Keep a
public field only when it is part of a real production contract.

## Bad


```python
# File: src/request_state.py
class RequestState:
    request_id: str = "request-1"  # <- error
    status: str = "queued"

    def summary(self) -> str:
        normalized = self.status.strip()
        if len(normalized) == 0: return "Request: unknown"
        return f"Request: {normalized.upper()}"

    def active(self) -> bool:
        if self.status == "closed": return False
        return len(self.status) > 0

    def status_length(self) -> int:
        length = 0
        for character in self.status:
            if character.strip(): length += 1
        return length

    def report(self) -> None:
        summary = self.summary()
        active = self.active()
        length = self.status_length()
        print(f"{summary} {active} {length}")
# File: cli.py
from src.request_state import RequestState
if __name__ == "__main__":
    state = RequestState()
    state.report()
```

## Good


```python
# File: src/request_state.py
class RequestState:
    """Responsibilities: _request state and status presentation_."""
    request_id: str = "request-1"
    _status: str

    def __init__(self, status: str) -> None:
        self._status = status

    def label(self) -> str:
        """Responsibilities: _request label composition_."""
        normalized = self._status.strip()
        if len(normalized) == 0: return self.request_id
        return f"{self.request_id}: {normalized.upper()}"

    def active(self) -> bool:
        """Responsibilities: _active status classification_."""
        if self._status == "closed": return False
        return len(self._status) > 0

    def status_length(self) -> int:
        """Responsibilities: _status length calculation_."""
        length = 0
        for character in self._status:
            if character.strip(): length += 1
        return length

    def report(self, request_id: str) -> None:
        """Responsibilities: _request status output_."""
        label = self.label()
        active = self.active()
        length = self.status_length()
        print(f"{request_id} {label} {active} {length}")
# File: cli.py
from src.request_state import RequestState
if __name__ == "__main__":
    state = RequestState("queued")
    state.report(RequestState.request_id)
```
