# `type-field-count`

Description: Keep named data contracts focused. A type contract may declare at most 10 fields.

## Bad


```python
# File: src/types.py
from typing import TypedDict

class RequestData(TypedDict):
    request_id: str
    method: str
    path: str
    query: str
    headers: str
    body: str
    started_at: int
    timeout_ms: int
    retry_count: int
    priority: int
    trace_id: str  # <- error
# File: src/request_reporter.py
from src.types import RequestData

class RequestReporter:
    def __init__(self, request: RequestData) -> None:
        self._request: RequestData = request

    def report(self) -> None:
        summary = self.summary()
        print(summary)

    def summary(self) -> str:
        fields = [
            f"id={self._request['request_id']}",
            f"method={self._request['method']}",
            f"path={self._request['path']}",
            f"query={self._request['query']}",
            f"headers={self._request['headers']}",
            f"body={self._request['body']}",
            f"started={self._request['started_at']}",
            f"timeout={self._request['timeout_ms']}",
            f"retries={self._request['retry_count']}",
            f"priority={self._request['priority']}",
            f"trace={self._request['trace_id']}",
        ]
        return " | ".join(fields)
# File: cli.py
from src.request_reporter import RequestReporter
from src.types import RequestData

if __name__ == "__main__":
    request: RequestData = {
        "request_id": "r-1", "method": "GET", "path": "/items",
        "query": "page=1", "headers": "accept=json", "body": "{}",
        "started_at": 10, "timeout_ms": 1000, "retry_count": 1,
        "priority": 2, "trace_id": "trace-1",
    }
    reporter = RequestReporter(request)
    reporter.report()
```

## Good


```python
# File: src/request_data.py
class RequestData:
    def __init__(self) -> None:
        self._request_id: str = "r-1"
        self._method: str = "GET"
        self._path: str = "/items"
        self._query: str = "page=1"
        self._headers: str = "accept=json"
        self._body: str = "{}"
        self._started_at: int = 10
        self._timeout_ms: int = 1000
        self._retry_count: int = 1
        self._priority: int = 2
        self._trace_id: str = "trace-1"

    def summary(self) -> str:
        fields = [
            f"id={self._request_id}",
            f"method={self._method}",
            f"path={self._path}",
            f"query={self._query}",
            f"headers={self._headers}",
            f"body={self._body}",
            f"started={self._started_at}",
            f"timeout={self._timeout_ms}",
            f"retries={self._retry_count}",
            f"priority={self._priority}",
            f"trace={self._trace_id}",
        ]
        return " | ".join(fields)

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.request_data import RequestData

if __name__ == "__main__":
    request = RequestData()
    request.report()
```
