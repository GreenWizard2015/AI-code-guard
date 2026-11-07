# `ternary-expression`

Description: Use explicit branches when a conditional expression hides a state transition.

## Bad

```python
# File: src/cache_result.py
class CacheResult:
    """Responsibilities: _cache result state_."""

    def __init__(self, ready: bool, cached_value: str, fallback_value: str) -> None:
        """Responsibilities: _cache result initialization_."""
        self._ready: bool = ready
        self._cached_value: str = cached_value
        self._fallback_value: str = fallback_value

    def select_source(self) -> str:
        """Responsibilities: _cache source selection_."""
        if self._ready:
            source = "cache"
        else:
            source = "fallback"
        normalized = source.strip()
        return normalized.upper()

    def select_value(self) -> str:
        """Responsibilities: _cache value selection_."""
        value = self._cached_value.strip() if self._ready else self._fallback_value.strip()  # <- error
        return value.strip()

    def report(self) -> str:
        """Responsibilities: _cache result reporting_."""
        source = self.select_source()
        value = self.select_value()
        result = f"{source}:{value}"
        print(result)
        return result
# File: cli.py
from src.cache_result import CacheResult

if __name__ == "__main__":
    result = CacheResult(True, "loaded", "reserve")
    result.report()
```

## Good

```python
# File: src/cache_result.py
class CacheResult:
    """Responsibilities: _cache result state_."""

    def __init__(self, ready: bool, cached_value: str, fallback_value: str) -> None:
        """Responsibilities: _cache result initialization_."""
        self._ready: bool = ready
        self._cached_value: str = cached_value
        self._fallback_value: str = fallback_value

    def select_source(self) -> str:
        """Responsibilities: _cache source selection_."""
        if self._ready:
            source = "cache"
        else:
            source = "fallback"
        normalized = source.strip()
        return normalized.upper()

    def select_value(self) -> str:
        """Responsibilities: _cache value selection_."""
        if self._ready:
            value = self._cached_value.strip()
        else:
            value = self._fallback_value.strip()
        return value.strip()

    def report(self) -> str:
        """Responsibilities: _cache result reporting_."""
        source = self.select_source()
        value = self.select_value()
        result = f"{source}:{value}"
        print(result)
        return result
# File: cli.py
from src.cache_result import CacheResult

if __name__ == "__main__":
    result = CacheResult(True, "loaded", "reserve")
    result.report()
```
