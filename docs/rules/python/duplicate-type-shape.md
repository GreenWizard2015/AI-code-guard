# `duplicate-type-shape`

Description: Reports distinct named object types or Python classes with identical sorted
field/type and base-type signatures. Field order does not affect the shape.
Python classes with different native bases remain distinct.

## Bad


```python
class JsonResponse:
    status: int
    payload: str

class TextResponse:
    payload: str
    status: int
```

## Good


```python
# File: src/protocols.py
from typing import Protocol

class JsonResponseContract(Protocol):
    """Responsibilities: _JSON response contract_."""

    def serialize(self) -> str: ...

class TextResponseContract(Protocol):
    """Responsibilities: _text response contract_."""

    def serialize(self) -> str: ...
```
