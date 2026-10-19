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
# File: functions.py
def resolve_value(flags: set[str]) -> str:
{%for status in statuses %}
    if "{{status.key}}" in flags:
        return "{{status.label}}"
{% endfor %}
    return "Unknown"
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
        self.labels: dict[str, str] = labels
        self.fallback: str = fallback

    def label_for_status(self, status: str) -> str:
        """Responsibilities: _single status lookup_."""
        label = self.labels.get(status)
        if label is None:
            return self.fallback
        return label

    def resolve_value(self, flags: set[str]) -> str:
        """Responsibilities: _priority status resolution_."""
        for status in self.labels:
            if status in flags:
                return self.label_for_status(status)
        return self.fallback

    def label_count(self) -> int:
        """Responsibilities: _available status-label counting_."""
        count = 0
        for label in self.labels.values():
            if label:
                count += 1
        return count
# File: cli.py
from src.status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels: dict[str, str] = {}
{%for status in statuses %}
    labels["{{status}}"] = "{{status}}"
{% endfor %}
    flags = {"alpha"}
    status_labels = StatusLabels(labels, "Unknown")
    label = status_labels.resolve_value(flags)
    fallback = status_labels.label_for_status("unknown")
    count = status_labels.label_count()
    print(label, fallback, count)
```
