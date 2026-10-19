# `stateless-class`

Description: A class with no state is often a namespace in disguise.

## Bad


```python
class Reader:
    def read(self) -> str:
        return "ok"
```

**Fix:** First search the whole repository for construction, type references, and member calls. Then
inspect callers for options, dependencies, and lifecycle data that belong together as immutable
class state. Keep the class when that state defines a real adapter or protocol boundary; otherwise
use module functions or composition. Do not add fields, wrappers, or methods only to silence lint.

## Good


```python
class ReaderContract(Protocol):
    def content_text(self) -> str: ...
```
