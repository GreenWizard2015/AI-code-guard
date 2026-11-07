# `production-test-import`

Description: Production code must not import a module from `tests/`, `__tests__/`, or a test-named file.
Tests may import production code.

Move reusable code into a production module and import it from both sides. Keep test helpers and
fixtures as test-only dependencies.

## Bad


```python
# File: src/application.py
from tests.support import support_message  # <- error

class Application:
    def __init__(self, prefix: str) -> None:
        self._prefix: str = prefix

    def status_message(self) -> str:
        return f"{self._prefix}: {support_message()}"

    def report(self) -> str:
        message = self.status_message()
        print(message)
        return message
# File: tests/__init__.py
# File: tests/support.py
def support_message() -> str:
    return "ready"
# File: tests/test_application.py
import unittest
from src.application import Application

class TestApplication(unittest.TestCase):
    def test_formats_a_status_message(self) -> None:
        application = Application("application")
        self.assertEqual(application.status_message(), "application: ready")

    def test_reports_the_status_message(self) -> None:
        application = Application("application")
        self.assertEqual(application.report(), "application: ready")
# File: cli.py
from src.application import Application

if __name__ == "__main__":
    application = Application("application")
    application.report()
```

## Good


```python
# File: src/__init__.py
# File: src/domain/__init__.py
# File: src/domain/item.py
class Item:
    def __init__(self, item_name: str, category: str, attributes: list[str]) -> None:
        self._item_name: str = item_name
        self._category: str = category
        self._attributes: list[str] = list(attributes)

    def normalized_name(self) -> str:
        words = self._item_name.strip().split()
        normalized_words: list[str] = []
        for word in words:
            if word:
                normalized_words.append(word)
        return " ".join(normalized_words)

    def description(self) -> str:
        return f"{self.normalized_name()} ({self._category})"

    def label(self) -> str:
        return f"{self._category}/{self.normalized_name()}"

    def attribute_count(self) -> int:
        count = 0
        for attribute in self._attributes:
            if attribute.strip():
                count += 1
        return count

    def summary(self) -> str:
        description = self.description()
        label = self.label()
        count = self.attribute_count()
        return f"{description} | {label} | {count} attributes"

    def report(self) -> None:
        print(self.summary())
# File: tests/__init__.py
# File: tests/domain/__init__.py
# File: tests/domain/test_item.py
import unittest
from src.domain.item import Item

class TestItem(unittest.TestCase):
    def test_normalizes_its_description(self) -> None:
        item = Item("  annual   invoice ", "archive", ["paid", "reviewed"])
        self.assertEqual(item.description(), "annual invoice (archive)")

    def test_formats_a_category_label(self) -> None:
        item = Item("invoice", "archive", ["paid"])
        self.assertEqual(item.label(), "archive/invoice")

    def test_counts_nonempty_attributes(self) -> None:
        item = Item("invoice", "archive", ["paid", "", "reviewed"])
        self.assertEqual(item.attribute_count(), 2)
# File: cli.py
from src.domain.item import Item

if __name__ == "__main__":
    item = Item("invoice", "archive", ["paid", "reviewed"])
    item.report()
```
