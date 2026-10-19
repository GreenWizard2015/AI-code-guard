# `local-inheritance`

Description: Inheriting from another project class couples ownership boundaries.

## Bad


```python
class Reader: pass
class CachedReader(Reader): pass
```

**Fix:** Prefer composition and dependency injection; implement a protocol when a shared contract is needed.

## Good


```python
class ReaderContract(Protocol):
    def content_text(self) -> str: ...
```
