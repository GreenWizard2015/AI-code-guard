# argument-count

Description: Replace a long positional call contract with a named request object that keeps the same operation and result.

## Bad


```python
# File: src/message_sender.py
class MessageSender:
    def send(self, recipient: str, subject: str, body: str, content_type: str, priority: int, retry_limit: int) -> str:
        return f"{recipient}:{subject}:{body}:{content_type}:{priority}:{retry_limit}"
```

## Good


```python
# File: src/protocols.py
from typing import Protocol
from urllib.request import Request

class MessageSenderContract(Protocol):
    def send(self, request: Request) -> str: ...
```
