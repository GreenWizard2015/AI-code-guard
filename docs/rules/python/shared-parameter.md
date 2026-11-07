# `shared-parameter`

Description: Repeated parameter pairs or bundles can reveal a shared domain contract. Match every annotated parameter by its exact `name:type` pair, regardless of type category; parameter order does not matter. Top-level functions are grouped project-wide and methods within their declaring class. Constructors and test methods are excluded; private methods count. Python special methods follow the same analysis.

## Bad

```python
# File: src/transfer_session.py
from typing import Mapping

class TransferSession:
    def __init__(self, data: Mapping[str, str], key: str) -> None:
        self._data: Mapping[str, str] = data
        self._key: str = key
    def send_one(self, data: Mapping[str, str], key: str) -> str:
        return data["name"] + key
    def send_two(self, key: str, data: Mapping[str, str]) -> str:
        return data["name"] + key  # <- error
    def send_three(self, data: Mapping[str, str], key: str) -> str:
        return data["name"] + key
    def send_four(self, data: Mapping[str, str], key: str) -> str:
        return data["name"] + key
    def report(self) -> None:
        print(self.send_one(self._data, self._key))
# File: cli.py
from src.transfer_session import TransferSession
if __name__ == "__main__":
    data = {"name": "item"}
    session = TransferSession(data, "a")
    session.send_one(data, "a")
    session.send_two("b", data)
    session.send_three(data, "c")
    session.send_four(data, "d")
    session.report()
```

The repeated pairs are `data:TransferData` and `key:str`. The second method reverses their positional order, but the set still matches.

## Good

```python
# File: src/protocols.py
from typing import Protocol

class TransferRequestContract(Protocol):
    def payload(self) -> str: ...
# File: src/transfer_data.py
from src.protocols import TransferRequestContract

class TransferData(TransferRequestContract):
    def __init__(self, name: str, key: str) -> None:
        self._name: str = name
        self._key: str = key
    def payload(self) -> str:
        name = self._name.strip()
        key = self._key.strip()
        if len(name) == 0 or len(key) == 0:
            return ""
        return f"{name}:{key}"
# File: src/transfer_session.py
from src.protocols import TransferRequestContract

class TransferSession:
    def __init__(self, request: TransferRequestContract, recipient: str) -> None:
        self._request: TransferRequestContract = request
        self._recipient: str = recipient
    def send(self) -> str:
        payload = self._request.payload()
        if len(payload) == 0:
            return "incomplete transfer"
        return f"{payload} {self.recipient_label()}"
    def recipient_label(self) -> str:
        return f"to {self._recipient}"
    def receipt(self) -> str:
        sent_transfer = self.send()
        return f"sent {sent_transfer}"
    def description(self) -> str:
        transfer_receipt = self.receipt()
        return f"transfer: {transfer_receipt}"
    def report(self) -> None:
        print(self.description())
# File: cli.py
from src.transfer_session import TransferSession
from src.transfer_data import TransferData

if __name__ == "__main__":
    request = TransferData("item", "a")
    session = TransferSession(request, "warehouse")
    session.report()
```
