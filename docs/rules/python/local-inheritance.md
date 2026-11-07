# `local-inheritance`

Description: A project class may inherit a project protocol, not a concrete class or type alias. A protocol may inherit only another protocol. Compose implementation objects instead of inheriting their behavior.

## Bad

```python
# File: src/reader.py
class ReaderBase:
    def read(self) -> str:
        return "ready"

    def report(self) -> None:
        content = self.read()
        print(content)

class CachedReader(ReaderBase):  # <- error
    pass
# File: cli.py
from src.reader import CachedReader

if __name__ == "__main__":
    reader = CachedReader()
    reader.report()
```

## Good

```python
# File: src/protocols.py
from typing import Protocol
class ContentCatalogContract(Protocol):
    def content_for(self, key: str) -> str: ...
    def content_count(self) -> int: ...
    def content_keys(self) -> list[str]: ...
class ExtendedContentCatalogContract(ContentCatalogContract, Protocol):
    def content_summary(self) -> str: ...
# File: src/content_catalog.py
from src.protocols import ExtendedContentCatalogContract
class ContentCatalog(ExtendedContentCatalogContract):
    """Responsibilities: _content lookup and catalog reporting_."""
    def __init__(self, records: dict[str, str]) -> None:
        """Responsibilities: _catalog initialization_."""
        self._records: dict[str, str] = records
    def content_for(self, key: str) -> str:
        """Responsibilities: _content selection_."""
        content = self._records.get(key)
        if content is None: return ""
        return content.strip()
    def content_count(self) -> int:
        """Responsibilities: _catalog content count_."""
        count = 0
        for content in self._records.values():
            if content: count += 1
        return count
    def content_keys(self) -> list[str]:
        keys = []
        for key in self._records:
            if key: keys.append(key)
        return keys
    def content_summary(self) -> str:
        keys = self.content_keys()
        return f"{self.content_count()} entries: {', '.join(keys)}"
    def report(self) -> None:
        summary = self.content_summary()
        content = self.content_for("ready")
        print(f"{content}; {summary}")
# File: cli.py
from src.content_catalog import ContentCatalog
if __name__ == "__main__":
    catalog = ContentCatalog({"ready": "ready"})
    catalog.report()
```
