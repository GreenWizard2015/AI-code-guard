# `class-size`

Description: Classes whose combined body-size metric is outside the configured range indicate weak
ownership.


### Fix

Split the class by cohesive capabilities without adding placeholder methods or hiding the original class behind wrappers.

## Bad


```python
{% const status_methods = [{"name":"member","visibility":"public","prefix":""},{"name":"group","visibility":"public","prefix":""},{"name":"page","visibility":"public","prefix":""},{"name":"post","visibility":"public","prefix":""},{"name":"photo","visibility":"public","prefix":""},{"name":"video","visibility":"public","prefix":""},{"name":"event","visibility":"public","prefix":""},{"name":"comment","visibility":"public","prefix":""},{"name":"reaction","visibility":"private","prefix":"_"},{"name":"message","visibility":"private","prefix":"_"},{"name":"thread","visibility":"private","prefix":"_"},{"name":"story","visibility":"private","prefix":"_"},{"name":"album","visibility":"private","prefix":"_"},{"name":"notification","visibility":"private","prefix":"_"},{"name":"attachment","visibility":"private","prefix":"_"},{"name":"contact","visibility":"private","prefix":"_"},{"name":"search","visibility":"public","prefix":""},{"name":"billing","visibility":"public","prefix":""},{"name":"audit","visibility":"public","prefix":""},{"name":"access","visibility":"public","prefix":""},{"name":"settings","visibility":"public","prefix":""},{"name":"export","visibility":"public","prefix":""}] %}
class StatusLabels:
{%for method in status_methods %}
    def {{method.prefix}}{{method.name}}_status(self) -> str:
        return "{{method.name}}"
{% endfor %}
```

## Good


```python
# File: src/status_labels/status_labels.py
class StatusLabels:
    """Responsibilities: _status label mapping_."""

    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        """Responsibilities: _mapping initialization_."""
        self.labels: dict[str, str] = labels
        self.fallback: str = fallback

    def label(self, status: str) -> str:
        """Responsibilities: _status label selection_."""
        if status in self.labels:
            return self.labels[status]
        return self.fallback

    def label_with_prefix(self, prefix: str, status: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        label = self.label(status)
        return f"{prefix}: {label}"

    def uppercase_fallback(self) -> str:
        """Responsibilities: _fallback capitalization_."""
        normalized = self.fallback.strip()
        return normalized.upper()

    def status_count(self) -> int:
        """Responsibilities: _mapping size reporting_."""
        count = 0
        for status_name in self.labels:
            if status_name:
                count += 1
        return count
# File: cli.py
from status_labels.status_labels import StatusLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    status_labels = StatusLabels(labels, "Unknown")
    label = status_labels.label("ready")
    detailed = status_labels.label_with_prefix("State", "blocked")
    fallback = status_labels.uppercase_fallback()
    count = status_labels.status_count()
    print(f"{label} {detailed} {fallback} {count}")
```
