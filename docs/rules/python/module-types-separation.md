# module-types-separation

Description: Keep a module-level type declaration in the exact sibling `types.ts` or `types.py`, separate from implementation.

## Bad


```python
# File: src/queue/message_queue.py
from typing import TypeAlias
MessageQueueOptions: TypeAlias = dict[str, int]
class MessageQueue:
    def __init__(self, options: MessageQueueOptions) -> None: self.options: MessageQueueOptions = options
```

## Good


```python
# File: src/queue/types.py
from typing import TypeAlias
MessageQueueCapacity: TypeAlias = int
# File: src/queue/protocols.py
from typing import Protocol
from src.queue.types import MessageQueueCapacity
class MessageQueueContract(Protocol):
    def capacity(self) -> MessageQueueCapacity: ...
    def accepts_size(self, size: int) -> bool: ...
```
