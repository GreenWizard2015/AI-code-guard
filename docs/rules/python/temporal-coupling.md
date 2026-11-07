# temporal-coupling

Description: The rule reports a field that is written by one non-constructor method and read
by another method without initialization in the constructor or field
declaration. This is a structural signal that callers must discover a hidden
method order; constructor-initialized fields and explicit state objects are
allowed.


Initialize the dependency in the constructor, or represent disconnected and
connected states as explicit objects. A deliberately lazy field should expose
its readiness transition instead of relying on an undocumented call order.

## Bad


```python
# File: src/session.py
class Session:
    def connect(self) -> None:
        self._socket = "connected"

    def send(self, message: str) -> str:
        return f"{self._socket}: {message}"

    def report(self) -> None:
        self.connect()
        print(self.send("ping"))
# File: cli.py
from src.session import Session

if __name__ == "__main__":
    session = Session()
    session.report()
```

## Good


```python
# File: src/session.py
class Session:
    def __init__(self, session_id: str, socket: str) -> None:
        self._session_id: str = session_id
        self._socket: str = socket

    def send(self, message: str) -> str:
        normalized_message = message.strip()
        return f"{self._session_id} via {self._socket}: {normalized_message}"

    def state_label(self) -> str:
        return f"Session {self._session_id} on {self._socket}"

    def socket_summary(self) -> str:
        socket_name = self._socket.strip().upper()
        socket_length = len(self._socket)
        return f"{socket_name} ({socket_length} characters)"

    def session_summary(self) -> str:
        state = self.state_label()
        socket = self.socket_summary()
        response = self.send("ping")
        return f"{state} | {socket} | {response}"

    def report(self) -> None:
        print(self.session_summary())
# File: cli.py
from src.session import Session

if __name__ == "__main__":
    session = Session("session-1", "connected")
    session.report()
```
