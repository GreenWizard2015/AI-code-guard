# contract-naming

Description: Python Protocols must end with `Contract`. Contract names must
also be domain names: they must not contain `Prot`, `Proto`, `Protocol`, or
`Interface`, in any casing or position.

Examples: `RuleContract`, `SourceNamesContract`, and `UserRepositoryContract`.
Avoid names such as `RuleProtocolContract`, `UserProtContract`, or `UserInterfaceContract`.

## Bad


```python
# File: src/protocols.py
from typing import Protocol

class ReaderProtContract(Protocol):
    def consume_content(self) -> str: ...
```

## Good


```python
# File: src/protocols.py
class ReaderContract(Protocol):
    """Responsibilities: _content reading contract_."""

    def consume_content(self) -> str: ...
```
