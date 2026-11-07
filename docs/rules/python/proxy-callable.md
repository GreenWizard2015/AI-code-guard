# `proxy-callable`

Description: A function that only forwards its arguments, forwards a zero-argument call, or exposes one property, adds no behavior.


## Bad


```python
# File: src/flow.py
class Flow:
    def update(self, identifier: str, title: str) -> str:
        return f"{identifier}: {title}"

# File: src/proxy.py
from src.flow import Flow

flow = Flow()
def update(identifier: str, title: str) -> str:
    return flow.update(identifier, title)

# File: src/output.py
class OutputReporter:
    def write(self, message: str) -> None:
        print(message)

# File: cli.py
from src.output import OutputReporter
from src.proxy import update

if __name__ == "__main__":
    message = update("u-1", "Ready")
    reporter = OutputReporter()
    reporter.write(message)
```

**Fix:** Call `flow.update()` at the caller or move real behavior to the owning class.

```python
# File: src/flow.py
class Flow:
    def update(self, identifier: str, title: str) -> str:
        return f"{identifier}: {title}"

# File: src/proxy.py
from src.flow import Flow

flow = Flow()
def update(identifier: str, title: str) -> None:
    flow.update(identifier, title)

# File: src/output.py
class OutputReporter:
    def write(self, message: str) -> None:
        print(message)

# File: cli.py
from src.output import OutputReporter
from src.proxy import update

if __name__ == "__main__":
    message = update("u-1", "Ready")
    reporter = OutputReporter()
    reporter.write(message)
```

## Good


```python
# File: src/domain/status.py
class Status:
    def __init__(self, value: str) -> None:
        self._value: str = value
    def normalized(self) -> str:
        trimmed = self._value.strip()
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
    def report(self) -> None:
        lines = [
            self.normalized(),
            str(self.ready()),
            self.label("State"),
            str(self.contains("ead")),
        ]
        print(" | ".join(lines))
# File: cli.py
from src.domain.status import Status
if __name__ == '__main__':
    status = Status(' READY ')
    status.report()
```
