# `proxy-lambda`

Description: Reject a lambda that only forwards its parameters, in any order, to a method of the current project-owned object.

```python
lambda expression, owner: self.resolve_owner(expression, owner)
```


Fix: Call the owning method directly or pass the owning object through the interface. The rule compares parameter references with forwarded argument references without requiring positional order or a special method name. Callbacks passed directly to external APIs, such as `HTMLElement.addEventListener`, are outside this rule because they are call arguments rather than object-property implementations.

## Bad


```python
class Context:
    def dispatch(self, expression: str, owner: str) -> str: return owner + expression
    def bad(self) -> object:
        return lambda expression, owner: self.dispatch(owner, expression)  # <- error
```

## Good


```python
# File: src/domain/status.py
class Status:
    def __init__(self, value: str) -> None:
        self.value: str = value
    def normalized(self) -> str:
        trimmed = self.value.strip()
        normalized_value = trimmed.lower()
        return normalized_value
    def ready(self) -> bool:
        normalized_value = self.normalized()
        expected_value = 'ready'
        return normalized_value == expected_value
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        return clean_prefix + ': ' + self.normalized()
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        return normalized_fragment in self.normalized()
# File: cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    print(status.normalized(), status.ready(), status.label('State'), status.contains('ead'))
```
