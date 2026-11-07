# `module-placement`

Description: Reports a production module that is nested below the common directory of its
importers. The diagnostic includes concrete destination candidates.

A deeper path is valid when its first focused folder is distinct from every
caller folder. The diagnostic also reminds the caller not to place the module
in a directory ignored by Git.

A grouped ownership path may be up to two directories below the common importer
boundary when its immediate directory contains at least three source files.
This permits populated domain groups while still reporting isolated deep files.

Prefer moving a module and its exported types/functions together. If the
module is shared, place it at the common boundary; otherwise keep it in one
focused folder that is not a caller folder and is not ignored by Git.

This applies to modules containing classes, types, functions, or mixed exports. The dependency should live at the first common ownership level, or in one deliberately focused subdirectory.

**Example:** `a/b/c/parser.ts` imported by `a/c/service.ts` and `a/view.ts` is a candidate for `a/parser.ts` or `a/parser/parser.ts`.


Fix: inspect all importers, move the module and its related exports to the ownership boundary, then update imports. Do not move a file only to silence the diagnostic or create a generic shared folder.

The diagnostic lists every top-level class, interface, protocol, type, constant,
variable, and function found in the misplaced module, followed by its focused
destination. Constants use the exact sibling `constants.ts` or `constants.py`,
types and interfaces use `types.ts` or `types.py`, protocols use
`protocols.ts` or `protocols.py`, and free functions use the project-root
`functions.ts` or `functions.py` file. This makes the move precise even when
the file contains constants or contracts rather than a class.
When the importer boundary is the repository root, it suggests either the file
in the repository root or a focused subdirectory directly under the root; it
never suggests moving above the root. A populated grouped ownership directory
is also valid within the documented depth limit.

## Bad


```python
# File: src/a/b/c/constants.py
MAX_ATTEMPTS = 3  # <- error
# File: src/a/attempt_reporter.py
class AttemptReporter:
    def __init__(self, prefix: str) -> None:
        self.__prefix = prefix

    def format_max_attempts(self, max_attempts: int) -> str:
        return f"{self.__prefix}: {max_attempts}"

    def report_max_attempts(self, max_attempts: int) -> None:
        print(self.format_max_attempts(max_attempts))
# File: src/a/cli.py
from src.a.b.c.constants import MAX_ATTEMPTS
from src.a.attempt_reporter import AttemptReporter

if __name__ == "__main__":
    reporter = AttemptReporter("primary maximum")
    reporter.report_max_attempts(MAX_ATTEMPTS)
# File: src/a/b/cli.py
from src.a.b.c.constants import MAX_ATTEMPTS
from src.a.attempt_reporter import AttemptReporter

if __name__ == "__main__":
    reporter = AttemptReporter("secondary maximum")
    reporter.report_max_attempts(MAX_ATTEMPTS)
```

## Good


```python
# File: src/a/constants.py
MAX_ATTEMPTS = 3
# File: src/a/attempt_reporter.py
class AttemptReporter:
    def __init__(self, prefix: str, max_attempts: int, warning_threshold: int = 2) -> None:
        self.__prefix: str = prefix
        self.__max_attempts: int = max_attempts
        self.__warning_threshold: int = warning_threshold

    def format_max_attempts(self) -> str:
        return f"{self.__prefix}: {self.__max_attempts}"

    def exceeds_warning_threshold(self) -> bool:
        return self.__max_attempts > self.__warning_threshold

    def threshold_status(self) -> str:
        if self.__max_attempts > self.__warning_threshold:
            return "above warning threshold"
        if self.__max_attempts == self.__warning_threshold:
            return "at warning threshold"
        return "within warning threshold"

    def warning_message(self) -> str:
        if not self.exceeds_warning_threshold():
            return ""
        return f"review {self.__max_attempts} attempts"

    def report_max_attempts(self) -> None:
        parts = [
            self.format_max_attempts(),
            self.threshold_status(),
        ]
        warning = self.warning_message()
        if warning:
            parts.append(warning)
        print(" | ".join(parts))
# File: src/a/cli.py
from src.a.constants import MAX_ATTEMPTS
from src.a.attempt_reporter import AttemptReporter

if __name__ == "__main__":
    reporter = AttemptReporter("primary maximum", MAX_ATTEMPTS, 2)
    reporter.report_max_attempts()
# File: src/a/b/cli.py
from src.a.constants import MAX_ATTEMPTS
from src.a.attempt_reporter import AttemptReporter

if __name__ == "__main__":
    reporter = AttemptReporter("secondary maximum", MAX_ATTEMPTS, 2)
    reporter.report_max_attempts()
```
