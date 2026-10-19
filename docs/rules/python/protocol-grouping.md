# `protocol-grouping`

Description: Group related protocol contracts in a focused module when they belong to the same boundary.

## Bad

```python
# File: src/message_reader.py
from typing import Protocol

class MessageReaderContract(Protocol):
    def message_for(self, message_id: str) -> str: ...
```

## Good

```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
