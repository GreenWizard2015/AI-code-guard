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
class Session:
    def connect(self) -> None: self._socket = create_socket()
    def send(self, message: str) -> None: self._socket.send(message)
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
