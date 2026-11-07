# `numeric-name`

Description: Names of project-owned symbols must not contain numbers. This applies to
classes, types, fields, methods, functions, parameters, and local variables in
both TypeScript and Python.


Use a descriptive word instead:


The rule does not inspect test files, consistent with the project policy that
test names and test-local naming are outside naming checks. External runtime
names are not declarations owned by the project and are not renamed by this
rule.

## Bad


```python
# File: status.py
class Status:
    def __init__(self, value: str) -> None:
        self.value: str = value
    def normalized(self) -> str:
        return self.value.strip().lower()
    def ready(self) -> bool:
        return self.normalized() == "ready"
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        status_value = self.normalized()
        if not normalized_fragment:
            return False
        return normalized_fragment in status_value
    def label(self, item1: str) -> str:
        return item1 + ": " + self.normalized()
    def report(self) -> None:
        normalized = self.normalized()
        label = self.label("State")
        contains = self.contains("ead")
        if self.ready():
            print(normalized, label, contains)
            return
        print("not ready", label)
# File: cli.py
if __name__ == "__main__":
    from status import Status
    status = Status(" READY ")
    status.report()
```

## Good


```python
# File: status.py
class Status:
    def __init__(self, value: str) -> None:
        self._value: str = value
    def normalized(self) -> str:
        return self._value.strip().lower()
    def ready(self) -> bool:
        return self.normalized() == "ready"
    def contains(self, fragment: str) -> bool:
        normalized_fragment = fragment.strip().lower()
        status_value = self.normalized()
        if not normalized_fragment:
            return False
        return normalized_fragment in status_value
    def label(self, prefix: str) -> str:
        return prefix + ": " + self.normalized()
    def report(self) -> None:
        normalized = self.normalized()
        label = self.label("State")
        contains = self.contains("ead")
        if self.ready():
            print(normalized, label, contains)
            return
        print("not ready", label)
# File: cli.py
if __name__ == "__main__":
    from status import Status
    status = Status(" READY ")
    status.report()
```
