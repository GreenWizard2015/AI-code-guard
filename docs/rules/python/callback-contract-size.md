# `callback-contract-size`

Description: Keep callback contracts to three or fewer parameters. A named TypeScript function
type or callback field, and a Python `Callable` parameter, is reported when it
accepts more than three values. Ordinary methods and functions are not measured.

Replace a multi-role callback with a named interface, protocol, or event object.

## Bad


```python
from collections.abc import Callable

def subscribe(callback: Callable[[str, str, str, str], None]) -> None:
    pass
```

## Good


```python
from typing import Protocol

class MemberChangedContract(Protocol):
    """Responsibilities: _member event contract_."""

    def changed(self, event: str) -> None: ...
```
