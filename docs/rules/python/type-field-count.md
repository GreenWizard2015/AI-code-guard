# `type-field-count`

Description: Keep named data contracts focused. A type contract may declare at most 10 fields.

## Bad


```python
# File: src/request_contract.py
class RequestContract:
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
```

## Good


```python
# File: src/request_contract.py
class RequestContract:
    request_id: str; method: str; path: str
    query: str; headers: str; body: str
    started_at: int; timeout_ms: int; retry_count: int
# File: src/cli.py
from src.request_contract import RequestContract
if __name__ == "__main__":
    request: RequestContract = RequestContract()
    request.request_id = "r-1"
    print(request.request_id, request.method, request.path, request.query, request.headers, request.body, request.started_at, request.timeout_ms, request.retry_count)
```
