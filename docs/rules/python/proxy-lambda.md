# `proxy-lambda`

Description: Reject a lambda that only forwards its parameters, in any order, to a method of the current project-owned object.

Fix: Call the owning method directly or pass the owning object through the interface. The rule compares parameter references with forwarded argument references without requiring positional order or a special method name. Callbacks passed directly to external APIs, such as `HTMLElement.addEventListener`, are outside this rule because they are call arguments rather than object-property implementations.

## Bad

```python
# File: src/protocols.py
from typing import Protocol

class DispatchContract(Protocol):
    def dispatch(self, expression: str, owner: str) -> str: ...
# File: src/status_dispatcher.py
from src.protocols import DispatchContract

class StatusDispatcher(DispatchContract):
    def __init__(self, channel: str) -> None:
        self._channel: str = channel

    def dispatch(self, expression: str, owner: str) -> str:
        normalized_expression = expression.strip().upper()
        normalized_owner = owner.strip().lower()
        return f"{self._channel}:{normalized_owner}:{normalized_expression}"

    def proxy_result(self, expression: str, owner: str) -> str:
        callback = lambda expression_text, owner_name: self.dispatch(owner_name, expression_text)  # <- error
        return callback(expression, owner)

    def report(self) -> None:
        result = self.proxy_result("ready", "worker")
        print(result)
# File: cli.py
from src.status_dispatcher import StatusDispatcher

if __name__ == "__main__":
    dispatcher = StatusDispatcher("queue")
    dispatcher.report()
```

## Good

```python
# File: src/protocols.py
from typing import Protocol

class DispatchContract(Protocol):
    def dispatch(self, expression: str, owner: str) -> str: ...
# File: src/status_route.py
from src.protocols import DispatchContract

class StatusRoute(DispatchContract):
    def _normalized_owner(self, owner_label: str) -> str:
        normalized_owner = owner_label.strip().lower()
        if len(normalized_owner) == 0:
            return "anonymous"
        return normalized_owner

    def __init__(self, channel: str) -> None:
        self._channel: str = channel

    def dispatch(self, expression: str, owner: str) -> str:
        normalized_expression = expression.strip().upper()
        normalized_owner = self._normalized_owner(owner)
        if len(normalized_expression) == 0:
            return f"{self._channel}:{normalized_owner}:empty"
        return f"{self._channel}:{normalized_owner}:{normalized_expression}"

    def local_owner(self, candidate_owner: str) -> bool:
        normalized_owner = self._normalized_owner(candidate_owner)
        return normalized_owner.startswith("worker")

    def report(self) -> None:
        result = self.dispatch("ready", "worker")
        owner_is_local = self.local_owner("worker")
        print(f"{result} | local={owner_is_local}")
# File: cli.py
from src.status_route import StatusRoute

if __name__ == "__main__":
    route = StatusRoute("queue")
    route.report()
```
