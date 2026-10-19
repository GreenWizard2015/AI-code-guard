# Interface And Protocol Fields

Description: See the examples below for the rule behavior.

### Purpose

Python `Protocol` classes define behavior boundaries. Writable attributes put state in the
contract and force every implementation to share representation. Expose values through methods.

### Preferred


```python
class UserStore(Protocol):
    def get(self, user_id: str) -> str: ...

class InMemoryUserStore:
    def __init__(self) -> None:
        self._cache: dict[str, str] = {}

    def get(self, user_id: str) -> str:
        return self._cache.get(user_id, '')
```

## Bad


```python
# File: src/user_store/user_store.py
class UserStoreContract(Protocol):
    cache: dict[str, str]

    def get(self, user_id: str) -> str: ...
```

## Good


```python
# File: src/protocols.py
class ReaderContract(Protocol):
    """Responsibilities: _content reading contract_."""

    def consume_content(self) -> str: ...
```
