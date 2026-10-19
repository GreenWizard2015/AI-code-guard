# `unused-type`

Description: Reports a type declaration with no production symbol usage. Test-only references
do not keep a production type alive.

## Bad


```python
# File: types.py
from typing import Literal, TypeAlias
MessageStatus: TypeAlias = Literal["queued", "delivered"]  # <- error
```

## Good


```python
# File: src/types.py
from typing import Literal, TypeAlias
MessageStatus: TypeAlias = Literal["queued", "delivered"]
# File: cli.py
from src.types import MessageStatus
if __name__ == "__main__":
    status: MessageStatus = "queued"
    print(status)
```
