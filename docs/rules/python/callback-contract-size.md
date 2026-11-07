# `callback-contract-size`

Description: Keep callback contracts to three or fewer parameters. A named TypeScript function
type or callback field, and a Python `Callable` parameter, is reported when it
accepts more than three values. Ordinary methods and functions are not measured.

Replace a multi-role callback with a named interface, protocol, or event object.

## Bad


```python
# File: src/member_change_publisher.py
from typing import Callable

class MemberChangePublisher:
    def __init__(self, owner: str, callback: Callable[[str, str, str, str], None]) -> None:
        self._owner: str = owner
        self._callback: Callable[[str, str, str, str], None] = callback

    def publish(self, name: str, before: str, after: str) -> None:
        normalized_name = name.strip()
        self._callback(self._owner, normalized_name, before, after)

    def summary(self, name: str, before: str, after: str) -> str:
        member = name.strip()
        previous = before.strip()
        current = after.strip()
        return f"{self._owner}.{member}: {previous} -> {current}"

    def report(self, name: str, before: str, after: str) -> None:
        self.publish(name, before, after)
        event_summary = self.summary(name, before, after)
        print(event_summary)
# File: cli.py
from src.member_change_publisher import MemberChangePublisher

if __name__ == "__main__":
    publisher = MemberChangePublisher("owner-1", lambda *_values: None)
    publisher.report("display_name", "Old", "New")
```

## Good


```python
# File: src/member_changed_event.py
class MemberChangedEvent:
    """Responsibilities: _member change event_."""

    def __init__(self, owner: str, name: str, before: str, after: str) -> None:
        """Responsibilities: _event construction_."""
        self._owner: str = owner
        self._name: str = name
        self._before: str = before
        self._after: str = after

    def owner_label(self) -> str:
        """Responsibilities: _owner label formatting_."""
        normalized_owner = self._owner.strip()
        return normalized_owner.upper()

    def member_label(self) -> str:
        """Responsibilities: _member label formatting_."""
        normalized_name = self._name.strip()
        return normalized_name.replace("_", " ")

    def transition_label(self) -> str:
        """Responsibilities: _value transition formatting_."""
        previous = self._before.strip()
        current = self._after.strip()
        return f"{previous} -> {current}"

    def report(self) -> None:
        """Responsibilities: _member change output_."""
        owner = self.owner_label()
        member = self.member_label()
        transition = self.transition_label()
        print(f"{owner}.{member}: {transition}")
# File: cli.py
from src.member_changed_event import MemberChangedEvent

if __name__ == "__main__":
    event = MemberChangedEvent("owner-1", "display_name", "Old", "New")
    event.report()
```
