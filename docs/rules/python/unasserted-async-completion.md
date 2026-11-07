# `unasserted-async-completion`

Description: In tests, await direct calls to locally declared async functions so completion and failures are observed. Production code and nested callbacks are outside this rule.

## Bad

```python
# File: src/label.py
class Label:
    def __init__(self, value: str) -> None:
        self.value: str = value
    def text(self) -> str:
        words = self.value.split()
        return " ".join(words)
    def upper_text(self) -> str:
        normalized = " ".join(self.value.split())
        uppercase = normalized.upper()
        return uppercase
    def word_count(self) -> int:
        words = self.value.split()
        return len(words)
    def readable(self) -> bool:
        words = self.value.split()
        return len(words) > 0
    def report(self) -> None:
        print(self.text(), self.upper_text(), self.word_count(), self.readable())
# File: tests/label/test_label.py
import unittest
from src.label import Label
class LabelTests(unittest.TestCase):
    def test_loads_label(self) -> None:
        label = Label(" Ada ")
        async def load_label() -> str:
            normalized = label.text().upper()
            count = label.word_count()
            return f"{normalized}:{count}"
        load_label()  # <- error
        actual = label.text()
        self.assertEqual(actual, "Ada")
    async def test_reads_label(self) -> None:
        label = Label("Ada")
        actual = label.text()
        self.assertEqual(actual, "Ada")
# File: cli.py
from src.label import Label
if __name__ == "__main__":
    label = Label(" Ada ")
    label.report()
```

## Good

Run the async operation to completion, then assert its result:

```python
# File: src/label.py
class Label:
    def __init__(self, value: str) -> None:
        self._value: str = value
    def text(self) -> str:
        words = self._value.split()
        return " ".join(words)
    def upper_text(self) -> str:
        normalized = " ".join(self._value.split())
        uppercase = normalized.upper()
        return uppercase
    def word_count(self) -> int:
        words = self._value.split()
        return len(words)
    def readable(self) -> bool:
        words = self._value.split()
        return len(words) > 0
    def report(self) -> None:
        print(self.text(), self.upper_text(), self.word_count(), self.readable())
# File: tests/label/test_label.py
import unittest
from src.label import Label
class LabelTests(unittest.TestCase):
    async def test_awaits_label(self) -> None:
        label = Label(" Ada ")
        async def load_label() -> str:
            normalized = label.text().upper()
            count = label.word_count()
            return f"{normalized}:{count}"
        actual = await load_label()
        self.assertEqual(actual, "ADA:1")
    async def test_awaits_another_label(self) -> None:
        label = Label("Lin")
        async def load_label() -> str:
            normalized = label.text().upper()
            count = label.word_count()
            return f"{normalized}:{count}"
        actual = await load_label()
        self.assertEqual(actual, "LIN:1")
# File: cli.py
from src.label import Label
if __name__ == "__main__":
    label = Label(" Ada ")
    label.report()
```
