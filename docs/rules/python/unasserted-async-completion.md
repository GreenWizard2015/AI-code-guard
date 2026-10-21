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
# File: tests/label/label_test.py
import asyncio
import unittest
from src.label import Label
async def load_label(label: Label) -> str:
    await asyncio.sleep(0)
    return label.text()
class LabelTests(unittest.TestCase):
    def test_loads_label(self) -> None:
        label = Label(" Ada ")
        load_label(label)  # <- error
        actual = label.text()
        self.assertEqual(actual, "Ada")
    def test_reads_label(self) -> None:
        label = Label("Ada")
        actual = label.text()
        self.assertEqual(actual, "Ada")
# File: cli.py
from src.label import Label
if __name__ == "__main__":
    label = Label(" Ada ")
    text = label.text()
    upper_text = label.upper_text()
    word_count = label.word_count()
    readable = label.readable()
    print(text, upper_text, word_count, readable)
```

## Good

Run the async operation to completion, then assert its result:

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
# File: tests/label/label_test.py
import asyncio
import unittest
from src.label import Label
class LabelTests(unittest.TestCase):
    def test_awaits_label(self) -> None:
        label = Label(" Ada ")
        async def load_label() -> str:
            await asyncio.sleep(0)
            return label.text()
        actual = asyncio.run(load_label())
        self.assertEqual(actual, "Ada")
    def test_awaits_another_label(self) -> None:
        label = Label("Lin")
        async def load_label() -> str:
            await asyncio.sleep(0)
            return label.text()
        actual = asyncio.run(load_label())
        self.assertEqual(actual, "Lin")
# File: cli.py
from src.label import Label
if __name__ == "__main__":
    label = Label(" Ada ")
    text = label.text()
    upper_text = label.upper_text()
    word_count = label.word_count()
    readable = label.readable()
    print(text, upper_text, word_count, readable)
```
