# `method-long-name`

Description: Review CamelCase method names containing more than six words, such as
`findCurrentUserByEmailAddress()` or
`registerServletContainerInitializerToDriveServletContextInitializers()`.
For Python, `_name` is private and `__name__` is a magic method; neither is
counted as an ordinary method name.
The name may be compensating for an oversized class scope. Inspect the class
boundary and decompose responsibilities before shortening mechanically.

## Bad


```python
# File: src/component_registry.py
class ComponentRegistry:
    def __init__(self, component_name: str) -> None:
        self._component_name: str = component_name

    def register_component_for_the_project_configuration_validation(self) -> str:  # <- error
        return f"Validated {self._component_name}"

    def report(self) -> None:
        result = self.register_component_for_the_project_configuration_validation()
        print(result)
# File: cli.py
from src.component_registry import ComponentRegistry

if __name__ == "__main__":
    registry = ComponentRegistry("search-index")
    registry.report()
```

## Good


```python
# File: src/price_labels.py
class PriceLabels:
    """Responsibilities: _status label mapping_."""

    def __init__(self, labels: dict[str, str], fallback: str) -> None:
        """Responsibilities: _mapping initialization_."""
        self._labels: dict[str, str] = labels
        self._fallback: str = fallback

    def label(self, status: str) -> str:
        """Responsibilities: _status label selection_."""
        if status in self._labels:
            return self._labels[status]
        return self._fallback

    def label_with_prefix(self, prefix: str, status: str) -> str:
        """Responsibilities: _prefixed label composition_."""
        label = self.label(status)
        return f"{prefix}: {label}"

    def uppercase_fallback(self) -> str:
        """Responsibilities: _fallback capitalization_."""
        normalized = self._fallback.strip()
        return normalized.upper()

    def status_count(self) -> int:
        """Responsibilities: _mapping size reporting_."""
        count = 0
        for status_name in self._labels:
            if status_name:
                count += 1
        return count
    def report(self) -> None:
        label = self.label("ready")
        detailed = self.label_with_prefix("State", "blocked")
        fallback = self.uppercase_fallback()
        count = self.status_count()
        print(f"{label} {detailed} {fallback} {count}")
# File: cli.py
from src.price_labels import PriceLabels

if __name__ == "__main__":
    labels = {"ready": "Ready", "blocked": "Blocked"}
    price_labels = PriceLabels(labels, "Unknown")
    price_labels.report()
```
