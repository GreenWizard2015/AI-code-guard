# Protocol downcast to implementation

Description: A value typed as a project Protocol is narrowed to a project implementation so code can call a member absent from the Protocol. Keep the behavior in the contract or validate external input at its boundary.

## Bad

```python
# File: src/store_gateway.py
from typing import Protocol

class StoreContract(Protocol):
    def entry(self, key: str) -> str: ...

class SqlStore(StoreContract):
    def __init__(self, records: dict[str, str]) -> None:
        self._records: dict[str, str] = records

    def entry(self, key: str) -> str:
        normalized = key.strip()
        return self._records.get(normalized, "missing")

    def sql_transaction(self) -> None:
        empty_keys = [key for key in self._records if len(key.strip()) == 0]
        for key in empty_keys:
            del self._records[key]

class StoreGateway:
    def _normalized_key(self, record_key: str) -> str:
        key_parts = record_key.strip().split()
        normalized_parts: list[str] = []
        for key_part in key_parts:
            normalized_part = key_part.lower()
            if normalized_part:
                normalized_parts.append(normalized_part)
        return "-".join(normalized_parts)

    def __init__(self, record_key: str, fallback: str) -> None:
        self._record_key: str = record_key
        self._fallback: str = fallback

    def entry(self, store: StoreContract) -> str:
        if isinstance(store, SqlStore):
            store.sql_transaction()  # <- error
        loaded_value = store.entry(self._normalized_key(self._record_key))
        return f"{self._fallback}{loaded_value}"

    def status_line(self, store: StoreContract) -> str:
        return f"Loaded {self.entry(store)}"

    def report(self, store: StoreContract) -> None:
        print(self.status_line(store))
# File: cli.py
from src.store_gateway import SqlStore, StoreGateway

if __name__ == "__main__":
    store = SqlStore({"primary": "value"})
    gateway = StoreGateway("primary", "default-")
    gateway.report(store)
```

## Good

```python
# File: src/protocols.py
from typing import Protocol

class StoreContract(Protocol):
    def entry(self, key: str) -> str: ...
    def transaction(self) -> None: ...

# File: src/sql_store.py
from src.protocols import StoreContract

class SqlStore(StoreContract):
    def __init__(self, records: dict[str, str]) -> None:
        self._records: dict[str, str] = records

    def entry(self, key: str) -> str:
        normalized = key.strip()
        return self._records.get(normalized, "missing")

    def transaction(self) -> None:
        empty_keys = [key for key in self._records if not key]
        for key in empty_keys:
            del self._records[key]

# File: src/store_summary.py
from src.protocols import StoreContract

class StoreSummary:
    def _normalized_key(self, record_key: str) -> str:
        key_parts = record_key.strip().split()
        normalized_parts: list[str] = []
        for key_part in key_parts:
            normalized_part = key_part.lower()
            if normalized_part:
                normalized_parts.append(normalized_part)
        return "-".join(normalized_parts)

    def __init__(self, store: StoreContract, prefix: str) -> None:
        self._store: StoreContract = store
        self._prefix: str = prefix

    def describe_record(self, record_key: str) -> str:
        normalized_key = self._normalized_key(record_key)
        self._store.transaction()
        stored_value = self._store.entry(normalized_key)
        return f"{normalized_key}: {stored_value.strip()}"

    def report(self) -> None:
        record = self.describe_record("primary")
        print(f"{self._prefix} {record}")
# File: cli.py
from src.sql_store import SqlStore
from src.store_summary import StoreSummary

if __name__ == "__main__":
    records: dict[str, str] = {"primary": "value"}
    store = SqlStore(records)
    summary = StoreSummary(store, "default-")
    summary.report()
```
