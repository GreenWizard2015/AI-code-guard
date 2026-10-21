# `non-english-source-text`

Description: Comments and inline string literals in source must use English. Put translated user-facing text in localization resources and reference it from code. Non-Latin scripts, including Cyrillic and CJK ideographs, are detected; Latin accents are allowed.

## Bad

```python
# File: cli.py
message = "你好，Добро пожаловать"
```

## Good

```python
# File: src/localization_catalog.py
class LocalizationCatalog:
    """Responsibilities: _localized message lookup_."""

    def __init__(self, messages: dict[str, str], fallback: str) -> None:
        """Responsibilities: _localization data initialization_."""
        self.messages: dict[str, str] = messages
        self.fallback: str = fallback

    def message(self, key: str) -> str:
        """Responsibilities: _message resolution_."""
        if key in self.messages:
            return self.messages[key]
        return self.fallback

    def message_with_context(self, context: str, key: str) -> str:
        """Responsibilities: _contextual message composition_."""
        message = self.message(key)
        return f"{context}: {message}"

    def normalized_fallback(self) -> str:
        """Responsibilities: _fallback normalization_."""
        normalized = self.fallback.strip()
        return normalized.upper()

    def message_count(self) -> int:
        """Responsibilities: _message count_."""
        count = 0
        for key in self.messages:
            if key:
                count += 1
        return count

# File: cli.py
from src.localization_catalog import LocalizationCatalog

if __name__ == "__main__":
    messages: dict[str, str] = {"welcome": "Welcome"}
    catalog = LocalizationCatalog(messages, "Unknown")
    welcome = catalog.message("welcome")
    contextual = catalog.message_with_context("Status", "welcome")
    fallback = catalog.normalized_fallback()
    count = catalog.message_count()
    print(f"{welcome} {contextual} {fallback} {count}")
```
