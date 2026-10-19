# contract-naming

Description: All TypeScript interfaces and Python Protocols must end with `Contract`.
Contract names must also be domain names: they must not contain `Proto`,
`Protocol`, or `Interface`.

Examples: `RuleContract`, `SourceNamesContract`, and `UserRepositoryContract`.
Avoid names such as `RuleProtocolContract` or `UserInterfaceContract`.

## Bad


```python
# File: src/protocols.py
from typing import Protocol

class ReaderProtocol(Protocol):
    def consume_content(self) -> str: ...
```

## Good


```python
# File: src/protocols.py
class ReaderContract(Protocol):
    """Responsibilities: _content reading contract_."""

    def consume_content(self) -> str: ...
```
