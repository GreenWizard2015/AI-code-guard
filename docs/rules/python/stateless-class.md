# `stateless-class`

Description: A class with no instance state is often a namespace in disguise. Implementing a protocol or merely storing readonly primitive values does not make it stateful. A typed constructor dependency counts when the class uses it; a scalar value counts when methods use it to enforce a domain decision or invariant. Mutable fields and collections that methods actually mutate also count. A locally owned collection used only for lookup does not count as state.

## Bad


```python
# File: src/reader.py
class Reader:
    def read(self) -> None:
        print("ok")

# File: cli.py
from src.reader import Reader

if __name__ == "__main__":
    reader = Reader()
    reader.read()
```

**Fix:** First search the whole repository for construction, type references, and member calls. Then
inspect callers for options, dependencies, and lifecycle data that belong together as immutable
class state. Keep the class when that state defines a real adapter or protocol boundary; otherwise
use module functions or composition. Do not add fields, wrappers, or methods only to silence lint.

## Good

```python
# File: src/reading_session.py
class ReadingSession:
    def __init__(self, source_name: str, lines: list[str]) -> None:
        self._source_name: str = source_name
        self._pending_lines: list[str] = list(lines)
        self._consumed_lines: list[str] = []

    def pending_count(self) -> int:
        return len(self._pending_lines)

    def take_next_line(self) -> str:
        if self.pending_count() == 0:
            raise IndexError("No pending lines")
        line = self._pending_lines.pop(0)
        self._consumed_lines.append(line)
        return line

    def consume_all_lines(self) -> list[str]:
        consumed_lines: list[str] = []
        while self.pending_count() > 0:
            consumed_lines.append(self.take_next_line())
        return consumed_lines

    def report(self) -> None:
        print(f"{self._source_name} ({len(self._consumed_lines)}): {', '.join(self._consumed_lines)}")

# File: src/cli.py
from src.reading_session import ReadingSession

if __name__ == "__main__":
    session = ReadingSession("daily-log", ["ok"])
    session.consume_all_lines()
    session.report()
```
