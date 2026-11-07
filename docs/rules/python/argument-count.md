# argument-count

Description: Replace a long positional call contract with a named request object that keeps the same operation and result.

## Bad


```python
# File: src/message_sender.py
class MessageSender:
    def __init__(self) -> None:
        self._sender_name: str = "queue"

    def send(self, recipient: str, subject: str, body: str, content_type: str, priority: int, retry_limit: int) -> str:
        return f"{self._sender_name}: {recipient}:{subject}:{body}:{content_type}:{priority}:{retry_limit}"

    def report(self) -> None:
        output = self.send("reader", "status", "ready", "text/plain", 2, 3)
        print(output)
# File: cli.py
from src.message_sender import MessageSender

if __name__ == "__main__":
    sender = MessageSender()
    sender.report()
```

## Good


```python
# File: src/protocols.py
from typing import Protocol

class MessageRequestContract(Protocol):
    def recipient(self) -> str: ...
    def subject(self) -> str: ...
    def body(self) -> str: ...
    def content_type(self) -> str: ...
    def priority(self) -> int: ...
    def retry_limit(self) -> int: ...

class MessageSenderContract(Protocol):
    def send(self, request: MessageRequestContract) -> str: ...
# File: src/message_request.py
class MessageRequest:
    def __init__(self) -> None:
        self._recipient: str = "reader"
        self._subject: str = "status"
        self._body: str = "ready"
        self._content_type: str = "text/plain"
        self._priority: int = 2
        self._retry_limit: int = 3

    def recipient(self) -> str:
        parts = self._recipient.strip().split()
        return " ".join(parts).lower()

    def subject(self) -> str:
        words = self._subject.strip().split()
        return " ".join(words)

    def body(self) -> str:
        lines = self._body.strip().splitlines()
        normalized_lines = [line.strip() for line in lines]
        return " ".join(normalized_lines)

    def content_type(self) -> str:
        normalized_type = self._content_type.strip()
        return normalized_type.lower()

    def priority(self) -> int:
        return max(0, self._priority)

    def retry_limit(self) -> int:
        return max(0, self._retry_limit)
# File: src/message_sender.py
from src.protocols import MessageRequestContract, MessageSenderContract

class MessageSender(MessageSenderContract):
    def __init__(self, request_source: MessageRequestContract) -> None:
        self._request_source: MessageRequestContract = request_source
        self._sender_name: str = "queue"

    def send(self, message_request: MessageRequestContract) -> str:
        recipient = message_request.recipient()
        subject = message_request.subject()
        body = message_request.body()
        content_type = message_request.content_type()
        priority = message_request.priority()
        retry_limit = message_request.retry_limit()
        return f"{self._sender_name}: {recipient}:{subject}:{body}:{content_type}:{priority}:{retry_limit}"

    def report(self) -> None:
        output = self.send(self._request_source)
        print(output)
# File: cli.py
from src.message_request import MessageRequest
from src.message_sender import MessageSender

if __name__ == "__main__":
    request = MessageRequest()
    sender = MessageSender(request)
    sender.report()
```
