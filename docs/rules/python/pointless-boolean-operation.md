# pointless-boolean-operation

Description: Reports a named boolean value identity comparison whose only body action is returning.
The syntax differs by language, but the hack is the same: a direct boolean
variable is hidden behind a branch that adds no behavior. Identity checks on
mapping lookups or other values with an unknown type are not reported.

## Bad

```python
# File: src/readiness.py
class Readiness:
    def __init__(self, value: bool, component: str) -> None:
        self.value: bool = value
        self.component: str = component
    def ready(self) -> bool:
        ready_value = self.value
        if ready_value is True:
            return True
        return False
    def label(self) -> str:
        if self.ready():
            return "ready"
        return "blocked"
    def description(self) -> str:
        state_label = self.label()
        return f"{self.component}: {state_label}"
    def matches_component(self, name: str) -> bool:
        return self.component == name
    def report(self) -> None:
        print(self.description())
# File: cli.py
if __name__ == "__main__":
    from src.readiness import Readiness
    readiness = Readiness(True, "worker")
    if readiness.matches_component("worker"):
        readiness.report()
```


## Good

```python
# File: src/readiness.py
class Readiness:
    def __init__(self, value: bool, component: str) -> None:
        self._value: bool = value
        self._component: str = component
    def ready(self) -> bool:
        return self._value
    def label(self) -> str:
        if self.ready():
            return "ready"
        return "blocked"
    def description(self) -> str:
        state_label = self.label()
        return f"{self._component}: {state_label}"
    def matches_component(self, name: str) -> bool:
        return self._component == name
    def report(self) -> None:
        print(self.description())
# File: cli.py
if __name__ == "__main__":
    from src.readiness import Readiness
    readiness = Readiness(True, "worker")
    if readiness.matches_component("worker"):
        readiness.report()
```

