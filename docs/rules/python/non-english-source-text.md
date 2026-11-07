# `non-english-source-text`

Description: Production comments and runtime string literals must use English. In test files, check comments only; test literals may use any language. Markdown and supported text-file prose is checked too. Strings in `__all__` and quoted type annotations are structural metadata, not runtime text. Non-Latin scripts, including Cyrillic and CJK ideographs, are detected; Latin accents are allowed.

## Bad

```python
# File: src/localization_catalog.py
class LocalizationCatalog:
    def __init__(self, messages: dict[str, str], fallback: str) -> None:
        self._messages: dict[str, str] = messages
        self._fallback: str = fallback

    def message(self, message_id: str) -> str:
        if message_id in self._messages:
            return self._messages[message_id]
        return self._fallback

    def message_with_context(self, context_label: str, contextual_id: str) -> str:
        return f"{context_label}: {self.message(contextual_id)}"

    def normalized_fallback(self) -> str:
        return self._fallback.strip().upper()

    def message_count(self) -> int:
        count = 0
        for key in self._messages:
            if key:
                count += 1
        return count

    def report(self) -> None:
        welcome = self.message("welcome")
        contextual = self.message_with_context("Status", "welcome")
        fallback = self.normalized_fallback()
        print(f"{welcome} | {contextual} | {fallback} ({self.message_count()} messages)")
# File: cli.py
from src.localization_catalog import LocalizationCatalog

if __name__ == "__main__":
    messages: dict[str, str] = {"welcome": "Добро пожаловать"}  # <- error
    catalog = LocalizationCatalog(messages, "Unknown")
    catalog.report()
```

## Good

```python
# File: src/localization_catalog.py
class LocalizationCatalog:
    """Responsibilities: _localized message lookup_."""

    def __init__(self, messages: dict[str, str], fallback: str) -> None:
        """Responsibilities: _localization data initialization_."""
        self._messages: dict[str, str] = messages
        self._fallback: str = fallback

    def message(self, message_id: str) -> str:
        """Responsibilities: _message resolution_."""
        if message_id in self._messages:
            return self._messages[message_id]
        return self._fallback

    def message_with_context(self, context_label: str, contextual_id: str) -> str:
        """Responsibilities: _contextual message composition_."""
        message = self.message(contextual_id)
        return f"{context_label}: {message}"

    def normalized_fallback(self) -> str:
        """Responsibilities: _fallback normalization_."""
        normalized = self._fallback.strip()
        return normalized.upper()

    def message_count(self) -> int:
        """Responsibilities: _message count_."""
        count = 0
        for key in self._messages:
            if key:
                count += 1
        return count

    def report(self) -> None:
        """Responsibilities: _localization report output_."""
        welcome = self.message("welcome")
        contextual = self.message_with_context("Status", "welcome")
        fallback = self.normalized_fallback()
        count = self.message_count()
        print(f"{welcome} | {contextual} | {fallback} | {count}")

# File: cli.py
from src.localization_catalog import LocalizationCatalog

if __name__ == "__main__":
    messages: dict[str, str] = {"welcome": "Welcome"}
    catalog = LocalizationCatalog(messages, "Unknown")
    catalog.report()
```
