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
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    pending: dict[str, str] = {}
    request_id = "request-1"
    status = "queued"
    pending[request_id] = status
    print(pending[request_id])
```
