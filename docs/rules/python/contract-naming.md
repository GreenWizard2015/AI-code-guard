# contract-naming

Description: Protocol declarations must use `Contract` exactly once, as the
final suffix. Concrete classes,
type aliases, and other declarations must not contain `Contract`, `Prot`,
`Proto`, `Protocol`, or `Interface`. Protocol names must not contain `Prot`,
`Proto`, `Protocol`, or `Interface`.

## Bad

```python
# File: src/cache_contract.py
class CacheContract:
    def __init__(self, value: str) -> None:
        self._value: str = value
    def content_text(self) -> str:
        trimmed = self._value.strip()
        if not trimmed:
            return ""
        words = trimmed.split()
        return " ".join(words)
    def readable(self) -> bool:
        content = self.content_text()
        words = content.split(" ")
        for word in words:
            if word:
                return True
        return False
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        value_text = self.content_text()
        if not clean_prefix:
            return value_text
        return f"{clean_prefix}: {value_text}"
    def report(self) -> None:
        label = self.label("Cache")
        populated = str(self.readable())
        print(f"{label} | {populated}")
# File: cli.py
from src.cache_contract import CacheContract

if __name__ == "__main__":
    cache = CacheContract("cached value")
    cache.report()
```

## Good

```python
# File: src/protocols.py
from typing import Protocol

class CacheContract(Protocol):
    def content_text(self) -> str: ...
    def readable(self) -> bool: ...
    def label(self, prefix: str) -> str: ...

# File: src/cache_entry.py
from src.protocols import CacheContract

class CacheEntry(CacheContract):
    def __init__(self, value: str) -> None:
        self._value: str = value
    def content_text(self) -> str:
        trimmed = self._value.strip()
        if not trimmed:
            return ""
        words = trimmed.split()
        return " ".join(words)
    def readable(self) -> bool:
        content = self.content_text()
        words = content.split(" ")
        for word in words:
            if word:
                return True
        return False
    def label(self, prefix: str) -> str:
        clean_prefix = prefix.strip()
        value_text = self.content_text()
        if not clean_prefix:
            return value_text
        return f"{clean_prefix}: {value_text}"
    def report(self) -> None:
        label = self.label("Cache")
        populated = str(self.readable())
        print(f"{label} | {populated}")

# File: cli.py
from src.cache_entry import CacheEntry

if __name__ == "__main__":
    cache = CacheEntry("cached value")
    cache.report()
```
