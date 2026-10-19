# `empty-contract`

Description: A naming-only interface or protocol adds indirection without defining a useful
behavior boundary. Keep at least one meaningful operation that consumers need.

## Bad


```python
# File: src/protocols.py
from typing import Protocol

class RepositoryContract(Protocol):
    pass
```

## Good


```python
# File: src/protocols.py
from typing import Protocol

class ReaderContract(Protocol):
    """Responsibilities: _content reading contract_."""

    def consume_content(self) -> str: ...
```
