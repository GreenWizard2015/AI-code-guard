# `hidden-global-state`

Description: Avoid independently mutating shared module-level collections from multiple
production callables. Give mutable state one explicit owner and lifecycle; local
state and a single owner with named transitions are allowed.

## Bad


```python
# File: src/request_state.py
pending: dict[str, str] = {}

def enqueue_request(request_id: str) -> None:
    pending.update({request_id: "queued"})

def cancel_request(request_id: str) -> None:
    pending.pop(request_id, None)

def report_requests() -> None:
    statuses = ", ".join(pending.values())
    print(f"Pending requests: {statuses}")
# File: cli.py
from src.request_state import enqueue_request, report_requests

if __name__ == "__main__":
    enqueue_request("request-1")
    report_requests()
```

## Good


```python
# File: src/request_queue.py
class RequestQueue:
    def __init__(self) -> None:
        self._queued_status: str = "queued"
        self._missing_status: str = "missing"
        self._summary_prefix: str = "Pending requests: "
        self._pending: dict[str, str] = {}

    def enqueue(self, new_request_id: str) -> None:
        self._pending[new_request_id] = self._queued_status

    def cancel(self, cancelled_request_id: str) -> None:
        self._pending.pop(cancelled_request_id, None)

    def status(self, lookup_request_id: str) -> str:
        current_status = self._pending.get(lookup_request_id)
        if current_status is None:
            return self._missing_status
        return current_status

    def summary(self) -> str:
        request_ids = list(self._pending.keys())
        statuses: list[str] = []
        for request_id in request_ids:
            statuses.append(self.status(request_id))
        return f"{self._summary_prefix}{', '.join(statuses)}"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.request_queue import RequestQueue

if __name__ == "__main__":
    requests = RequestQueue()
    first_request_id = "request-1"
    second_request_id = "request-2"
    requests.enqueue(first_request_id)
    requests.enqueue(second_request_id)
    requests.cancel(second_request_id)
    requests.report()
```
