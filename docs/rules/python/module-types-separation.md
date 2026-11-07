# module-types-separation

Description: Keep a module-level type declaration in the exact sibling `types.ts` or `types.py`, separate from implementation.

## Bad


```python
# File: src/queue/message_queue.py
from typing import TypeAlias

MessageQueueOptions: TypeAlias = dict[str, int]

class MessageQueue:
    def __init__(self, capacity: int) -> None:
        self._capacity: int = capacity

    def options(self) -> MessageQueueOptions:
        return {"capacity": self._capacity}

    def available_capacity(self, reserved: int) -> int:
        available = self._capacity - reserved
        return max(0, available)

    def capacity_label(self) -> str:
        if self._capacity < 10:
            return "compact"
        if self._capacity < 100:
            return "standard"
        return "large"

    def summary(self) -> str:
        label = self.capacity_label()
        available = self.available_capacity(0)
        options = self.options()
        return f"{label} queue with {available} slots and {len(options)} setting"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.queue.message_queue import MessageQueue

if __name__ == "__main__":
    queue = MessageQueue(8)
    queue.report()
```

## Good


```python
# File: src/queue/types.py
from typing import TypeAlias

MessageQueueOptions: TypeAlias = dict[str, int]
# File: src/queue/message_queue.py
from src.queue.types import MessageQueueOptions

class MessageQueue:
    def __init__(self, capacity: int) -> None:
        self._capacity: int = capacity

    def options(self) -> MessageQueueOptions:
        return {"capacity": self._capacity}

    def available_capacity(self, reserved: int) -> int:
        available = self._capacity - reserved
        return max(0, available)

    def capacity_label(self) -> str:
        if self._capacity < 10:
            return "compact"
        if self._capacity < 100:
            return "standard"
        return "large"

    def summary(self) -> str:
        label = self.capacity_label()
        available = self.available_capacity(0)
        options = self.options()
        return f"{label} queue with {available} slots and {len(options)} setting"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.queue.message_queue import MessageQueue

if __name__ == "__main__":
    queue = MessageQueue(8)
    queue.report()
```
