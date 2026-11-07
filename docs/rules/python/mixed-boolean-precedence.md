# `mixed-boolean-precedence`

Description: Split a boolean expression or add parentheses when it mixes `&&`, `||`, and `!` in one ungrouped expression. The Python equivalents are `and`, `or`, and `not`. Also group negation before a comparison when its scope is not explicit.

## Bad


```python
# File: src/delivery_decision.py
class DeliveryDecision:
    """Responsibilities: _delivery decision_."""

    def __init__(self) -> None:
        """Responsibilities: _decision initialization_."""
        self._conditions: dict[str, str] = {
            "readiness": "ready",
            "token": "missing",
            "override": "active",
            "inventory": "present",
            "expected": "empty",
        }

    def release_permitted(self) -> bool:
        """Responsibilities: _release permission evaluation_."""
        return self._conditions["readiness"] == "ready" and self._conditions["token"] == "valid" or self._conditions["override"] == "active"  # <- error

    def items_differ(self) -> bool:
        """Responsibilities: _inventory difference evaluation_."""
        return not self._conditions["inventory"] == self._conditions["expected"]  # <- error

    def summary(self) -> str:
        """Responsibilities: _decision summary formatting_."""
        return f"Release permitted: {self.release_permitted()}, items differ: {self.items_differ()}"

    def report(self) -> None:
        """Responsibilities: _decision report output_."""
        print(self.summary())
# File: cli.py
from src.delivery_decision import DeliveryDecision

if __name__ == "__main__":
    decision = DeliveryDecision()
    decision.report()
```

## Good


```python
# File: src/delivery_decision.py
class DeliveryDecision:
    """Responsibilities: _delivery decision_."""

    def __init__(self) -> None:
        """Responsibilities: _decision initialization_."""
        self._conditions: dict[str, str] = {
            "readiness": "ready",
            "token": "missing",
            "override": "active",
            "inventory": "present",
            "expected": "empty",
        }

    def release_permitted(self) -> bool:
        """Responsibilities: _release permission evaluation_."""
        readiness = self._conditions["readiness"] == "ready"
        token_valid = self._conditions["token"] == "valid"
        override_active = self._conditions["override"] == "active"
        return readiness and (token_valid or override_active)

    def items_differ(self) -> bool:
        """Responsibilities: _inventory difference evaluation_."""
        inventory = self._conditions["inventory"]
        expected = self._conditions["expected"]
        return not (inventory == expected)

    def summary(self) -> str:
        """Responsibilities: _decision summary formatting_."""
        return f"Release permitted: {self.release_permitted()}, items differ: {self.items_differ()}"

    def report(self) -> None:
        """Responsibilities: _decision report output_."""
        print(self.summary())
# File: cli.py
from src.delivery_decision import DeliveryDecision

if __name__ == "__main__":
    decision = DeliveryDecision()
    decision.report()
```
