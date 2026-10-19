# `composite-state-type`

Description: See the examples below for the rule behavior.

### Policy

Do not represent a domain state or a boundary value with a composite union or intersection type.

### Fix

Define an interface for the shared contract and real specialized classes for each state or representation.


Python uses the same named-state boundary:

```python
class UserLookup(Protocol):
    def is_found(self) -> bool: ...

class FoundUser(UserLookup):
    def is_found(self) -> bool:
        return True
```

This applies to unions such as `Buffer | string` and intersections such as `Buffer & Metadata` at fields, parameters, and return boundaries. Wrap the representations behind a named interface and specialized classes. It also applies to object-state unions with a string or boolean discriminant.

Literal unions, compiler unions, and primitive unions are also covered. A literal such as `'found'` may remain a field value on the interface, but the contract itself must not branch into a union type.

### JSON-RPC responses

For an outgoing JSON-RPC tool response, use separate response classes instead of
a composite `JsonRpcResponse` object with optional `result` and `error` fields.
`ToolResponse.payload()` and `ToolErrorResponse.payload()` should create the
structural JSON object immediately before it is passed to the transport. This
keeps the external wire format intact while preventing mutually exclusive
response states from spreading through production code.

## Bad


```python
# File: src/user_lookup.py
class PresentUser:
    def __init__(self) -> None:
        self.user_id: str = "user-1"

class MissingUser:
    def __init__(self) -> None:
        self.reason: str = "not found"

UserState = PresentUser | MissingUser
# File: cli.py
from src.user_lookup import MissingUser, UserState

if __name__ == "__main__":
    user: UserState = MissingUser()
    print(user)
```

## Good


```python
# File: src/types.py
Item: TypeAlias = str
# File: cli.py
from src.types import Item
from typing import TypeAlias

if __name__ == "__main__":
    type_items: list[Item] = []
    print(len(type_items))
```
