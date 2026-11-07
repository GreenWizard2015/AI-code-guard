# `dynamic-import`

Description: Use static imports for project-owned dependencies so their contracts remain visible during analysis.

## Bad

```python
# File: src/constants.py
ITEM_NAME = "item loaded"
# File: src/item_reporter.py
import importlib

class ItemReporter:
    """Responsibilities: _item reporting_."""

    def _resolve_name(self) -> str:
        """Responsibilities: _dynamic item name lookup_."""
        module = importlib.import_module("src.constants")  # <- error
        name = str(module.ITEM_NAME).strip()
        if len(name) == 0:
            return "unknown"
        return name.lower()

    def _word_count(self) -> int:
        """Responsibilities: _item word counting_."""
        word_count = 0
        for word in self._resolve_name().split():
            if len(word) > 0:
                word_count += 1
        return word_count

    def __init__(self, prefix: str) -> None:
        """Responsibilities: _report prefix state_."""
        self._prefix: str = prefix

    def format_label(self) -> str:
        """Responsibilities: _item label formatting_."""
        return f"{self._prefix}: {self._resolve_name().strip()}"

    def report(self) -> None:
        """Responsibilities: _item label output_."""
        label = self.format_label()
        print(f"{label} ({self._word_count()} words)")
# File: cli.py
from src.item_reporter import ItemReporter

if __name__ == "__main__":
    reporter = ItemReporter("State")
    reporter.report()
```

## Good

```python
# File: src/constants.py
ITEM_NAME = "item loaded"
# File: src/item_reporter.py
from src.constants import ITEM_NAME

class ItemReporter:
    """Responsibilities: _item reporting_."""

    def _normalized_name(self) -> str:
        """Responsibilities: _item name normalization_."""
        name = ITEM_NAME.strip()
        if len(name) == 0:
            return "unknown"
        return name.lower()

    def _word_count(self) -> int:
        """Responsibilities: _item word counting_."""
        word_count = 0
        for word in self._normalized_name().split():
            if len(word) > 0:
                word_count += 1
        return word_count

    def __init__(self, prefix: str) -> None:
        """Responsibilities: _report prefix state_."""
        self._prefix: str = prefix

    def format_label(self) -> str:
        """Responsibilities: _item label formatting_."""
        return f"{self._prefix}: {self._normalized_name()}"

    def report(self) -> None:
        """Responsibilities: _item label output_."""
        label = self.format_label()
        print(f"{label} ({self._word_count()} words)")
# File: cli.py
from src.item_reporter import ItemReporter

if __name__ == "__main__":
    reporter = ItemReporter("State")
    reporter.report()
```
