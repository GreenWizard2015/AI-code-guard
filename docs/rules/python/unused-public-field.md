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
# File: cli.py
from src.request_state import RequestState
if __name__ == "__main__":
    state = RequestState()
    print(state.summary(), state.active(), state.status_length())
```

## Good


```python
# File: src/request_state.py
"""Responsibilities: _request state and status presentation_."""
class RequestState:
    request_id: str = "request-1"
    status: str = "queued"

    def label(self) -> str:
        """Responsibilities: _request label composition_."""
        normalized = self.status.strip()
        if len(normalized) == 0: return self.request_id
        return f"{self.request_id}: {normalized.upper()}"

    def active(self) -> bool:
        """Responsibilities: _active status classification_."""
        if self.status == "closed": return False
        return len(self.status) > 0

    def status_length(self) -> int:
        """Responsibilities: _status length calculation_."""
        length = 0
        for character in self.status:
            if character.strip(): length += 1
        return length
# File: cli.py
from src.request_state import RequestState
if __name__ == "__main__":
    state = RequestState()
    print(state.label(), state.active(), state.status_length())
```
