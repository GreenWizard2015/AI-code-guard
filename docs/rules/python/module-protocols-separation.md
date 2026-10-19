# module-protocols-separation

Description: Keep a module-level protocol in the sibling `protocols.ts` or `protocols.py` file.

## Bad


```python
# File: src/queue.py
from typing import Protocol
class MessageQueueContract(Protocol):
    def enqueue(self, message: str) -> None: ...
class MessageQueue:
    def enqueue(self, message: str) -> None: pass
```

## Good


```python
# File: src/protocols.py
from typing import Protocol
class MessageQueueContract(Protocol):
    """Responsibilities: _queue operation contract_."""
    def enqueue(self, message: str) -> None: ...
    def count(self) -> int: ...
class QueueStatusContract(Protocol):
    def empty(self) -> bool: ...
# File: src/message_queue.py
from src.protocols import MessageQueueContract
from src.protocols import QueueStatusContract
class MessageQueue(MessageQueueContract, QueueStatusContract):
    """Responsibilities: _queue state_, _message operations_."""
    def __init__(self) -> None:
        self.messages: list[str] = []
    def enqueue(self, message: str) -> None:
        """Responsibilities: _message storage_."""
        normalized = message.strip()
        if normalized: self.messages.append(normalized)
    def count(self) -> int:
        """Responsibilities: _queue size_."""
        count = 0
        for message in self.messages:
            if message: count += 1
        return count
    def empty(self) -> bool:
        """Responsibilities: _empty queue classification_."""
        for message in self.messages:
            if message: return False
        return True
# File: cli.py
from src.message_queue import MessageQueue
if __name__ == "__main__":
    queue = MessageQueue()
    queue.enqueue("message")
    print(queue.count(), queue.empty())
```
