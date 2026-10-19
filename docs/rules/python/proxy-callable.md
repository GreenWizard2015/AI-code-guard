# `proxy-callable`

Description: A function that only forwards its arguments, forwards a zero-argument call, or exposes one property, adds no behavior.


## Bad


```python
def update(identifier: str, title: str) -> str:
    return flow.update(identifier, title)
```

**Fix:** Call `flow.update()` at the caller or move real behavior to the owning class.

```python
def update(identifier: str, title: str) -> None:
    flow.update(identifier, title)
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
