# `callable-branch-count`

Description: Named production callables should not accumulate more than ten independent
branch points. The metric counts `if`, loops, conditional expressions, switch
clauses, and catch branches. Nested callables are measured separately; tests
are excluded.

Move repeated value-to-result decisions into a lookup when that keeps the
mapping clear. Keep legitimate branching when it is one cohesive algorithm and
remains below the limit.

## Bad

The callable itself exceeds the branch limit:


```python
{% const statuses = ["alpha","bravo","charlie","delta","echo","foxtrot","golf","hotel","india","juliet","kilo"] %}
# File: src/status_resolver.py
class StatusResolver:
    def resolve_value(self, flags: set[str]) -> str:
{%for status in statuses %}
        if "{{status}}" in flags:
            return "{{status}}"
{% endfor %}
        return "Unknown"

    def report(self) -> None:
        print(self.resolve_value({"alpha"}))
# File: cli.py
from src.status_resolver import StatusResolver

if __name__ == "__main__":
    resolver = StatusResolver()
    resolver.report()
```

## Good

The lookup preserves the same eleven mappings, priority order, and fallback.


```python
{% const statuses = ["alpha","bravo","charlie","delta","echo","foxtrot","golf","hotel","india","juliet","kilo"] %}
# File: src/status_labels/status_labels.py
class StatusLabels:
    """Responsibilities: _status label collection_."""

    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        """Responsibilities: _status label initialization_."""
        self._labels: dict[str, str] = labels
        self._fallback: str = fallback

    def label_for_status(self, status: str) -> str:
        """Responsibilities: _single status lookup_."""
        label = self._labels.get(status)
        if label is None:
            return self._fallback
        return label

    def resolve_value(self, flags: set[str]) -> str:
        """Responsibilities: _priority status resolution_."""
        for status in self._labels:
            if status in flags:
                return self.label_for_status(status)
        return self._fallback

    def label_count(self) -> int:
        """Responsibilities: _available status-label counting_."""
        count = 0
        for label in self._labels.values():
            if label:
                count += 1
        return count

    def report(self) -> None:
        """Responsibilities: _status resolution report_."""
        label = self.resolve_value({"alpha"})
        fallback = self.label_for_status("unknown")
        print(label, fallback, self.label_count())
# File: cli.py
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels: dict[str, str] = {}
{%for status in statuses %}
    labels["{{status}}"] = "{{status}}"
{% endfor %}
    status_labels = StatusLabels(labels, "Unknown")
    status_labels.report()
```
