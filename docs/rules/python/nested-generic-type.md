# `nested-generic-type`

Description: Name nested generic applications at a contract boundary. For example, prefer
`Promise<Result>` or `list[Result]` to nested generic types that conceal several
representations in one signature.

## Bad


```python
# File: src/lookup.py
class Lookup:
    def emit(self, values: list[dict[str, str]]) -> None:
        print(values[0]["value"])

# File: cli.py
from src.lookup import Lookup

if __name__ == "__main__":
    Lookup().emit([{"value": "ready"}])
```

## Good


```python
# File: src/types.py
LookupRecord = dict[str, str]
LookupResults = list[LookupRecord]
# File: src/lookup_results_reporter.py
from src.types import LookupRecord, LookupResults

class LookupResultsReporter:
    def __init__(self) -> None:
        self._results_by_key: dict[str, LookupRecord] = {}

    def add(self, results: LookupResults) -> None:
        for record in results:
            self._results_by_key[record["value"]] = record

    def result_count(self) -> int:
        return len(self._results_by_key)

    def format_results(self) -> str:
        values = [record["value"] for record in self._results_by_key.values()]
        return ",".join(values)

    def report(self) -> None:
        print(self.format_results())

    def clear(self) -> None:
        self._results_by_key.clear()

# File: cli.py
from src.lookup_results_reporter import LookupResultsReporter

if __name__ == "__main__":
    reporter = LookupResultsReporter()
    reporter.add([{"value": "ready"}])
    if reporter.result_count() > 0:
        reporter.report()
    reporter.clear()
```
