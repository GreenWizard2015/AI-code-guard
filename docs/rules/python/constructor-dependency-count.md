# constructor-dependency-count

Description: Reports a class whose resolved composition graph contains more than five
different project-owned class dependencies initialized as part of its object
construction.

The rule counts resolved project classes only. Collections, regular
expressions, built-ins, external packages, and unresolved names are
not counted. The same dependency used more than once counts once.

Split the class or introduce a focused collaborator that owns one cohesive
dependency group. This is a composition rule, not a raw count of every `new`
expression in a constructor.

## Bad


```python
{% const dependencies = [{"module":"account_store","name":"AccountStore","field":"account_store"},{"module":"billing_ledger","name":"BillingLedger","field":"billing_ledger"},{"module":"catalog_index","name":"CatalogIndex","field":"catalog_index"},{"module":"system_clock","name":"SystemClock","field":"system_clock"},{"module":"mail_gateway","name":"MailGateway","field":"mail_gateway"},{"module":"stock_ledger","name":"StockLedger","field":"stock_ledger"}] %}
# File: src/checkout_application/checkout_application.py
{%for dependency in dependencies %}
from src.{{dependency.module}}.{{dependency.module}} import {{dependency.name}}
{% endfor %}

class CheckoutApplication:

    def __init__(self) -> None:
{%for dependency in dependencies %}
        self.{{dependency.field}}: {{dependency.name}} = {{dependency.name}}()
{% endfor %}

    def run(self) -> str:
        return "started"
{%for dependency in dependencies %}
# File: src/{{dependency.module}}/{{dependency.module}}.py
class {{dependency.name}}:
    pass
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
    status_labels = StatusLabels({"ready": "Ready", "blocked": "Blocked"}, "Unknown")
    label = status_labels.label("ready")
    detailed = status_labels.label_with_prefix("State", "blocked")
    print(label, detailed, status_labels.uppercase_fallback(), status_labels.status_count())
```
