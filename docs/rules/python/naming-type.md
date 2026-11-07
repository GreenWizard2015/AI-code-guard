# `naming-type`

Description: Name type declarations with PascalCase and without underscores.

## Bad

```python
# File: src/types.py
from typing import TypeAlias

item_count: TypeAlias = int  # <- error
# File: src/count_reporter.py
from src.types import item_count

class CountReporter:
    def __init__(self, count: item_count) -> None:
        self._count: item_count = count

    def normalized_count(self) -> int:
        return max(0, self._count)

    def digit_count(self) -> int:
        rendered_count = str(self.normalized_count())
        return len(rendered_count)

    def count_label(self) -> str:
        normalized = self.normalized_count()
        digits = self.digit_count()
        return f"Items: {normalized} ({digits} digits)"

    def positive(self) -> bool:
        return self.normalized_count() > 0

    def report(self) -> None:
        label = self.count_label()
        positive = self.positive()
        print(f"{label} positive={positive}")
# File: cli.py
from src.count_reporter import CountReporter

if __name__ == "__main__":
    reporter = CountReporter(3)
    reporter.report()
```

## Good

```python
# File: src/types.py
from typing import TypeAlias

ItemCount: TypeAlias = int
# File: src/count_reporter.py
from src.types import ItemCount

class CountReporter:
    def __init__(self, count: ItemCount) -> None:
        self._count: ItemCount = count

    def normalized_count(self) -> int:
        return max(0, self._count)

    def digit_count(self) -> int:
        rendered_count = str(self.normalized_count())
        return len(rendered_count)

    def count_label(self) -> str:
        normalized = self.normalized_count()
        digits = self.digit_count()
        return f"Items: {normalized} ({digits} digits)"

    def positive(self) -> bool:
        return self.normalized_count() > 0

    def report(self) -> None:
        label = self.count_label()
        positive = self.positive()
        print(f"{label} positive={positive}")
# File: cli.py
from src.count_reporter import CountReporter

if __name__ == "__main__":
    reporter = CountReporter(3)
    reporter.report()
```
