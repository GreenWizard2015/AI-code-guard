# `composite-state-type`

Description: Do not combine named domain contracts with `|` or `&`. Keep simultaneous concepts in named fields; model exclusive runtime states with distinct classes. Literal and nullable unions are covered by other rules.

## Bad

```python
# File: src/protocols.py
from typing import Protocol

class UserIdentityContract(Protocol):
    def normalized_id(self) -> str: ...

class UserDetailsContract(Protocol):
    def display_name(self) -> str: ...

# File: src/user_summary.py
from __future__ import annotations
from src.protocols import UserDetailsContract, UserIdentityContract

def emit_user_summary(summary: UserIdentityContract & UserDetailsContract) -> None:
    print(f"{summary.normalized_id()}: {summary.display_name()}")

# File: cli.py
from src.user_summary import emit_user_summary

class UserSummaryValue:
    def normalized_id(self) -> str:
        return "u-1"
    def display_name(self) -> str:
        return "Ada"

if __name__ == "__main__":
    emit_user_summary(UserSummaryValue())
```

## Good

Preserve each contract as a typed field and use concrete implementations:

```python
# File: src/types.py
UserIdentity = str
UserDetails = str
# File: src/protocols.py
from typing import Protocol

class UserSummaryContract(Protocol):
    def identity_label(self) -> str: ...
    def summary_label(self) -> str: ...
# File: src/user_summary.py
from src.protocols import UserSummaryContract
from src.types import UserDetails, UserIdentity

class UserSummary(UserSummaryContract):
    def __init__(self, identity: UserIdentity, details: UserDetails) -> None:
        self._identity: UserIdentity = identity.strip()
        self._details: UserDetails = details.strip()

    def identified(self) -> bool:
        return len(self._identity) > 0

    def identity_label(self) -> str:
        if not self.identified():
            return "unknown user"
        return f"user {self._identity}"
    def details_label(self) -> str:
        if not self._details:
            return "no details"
        return f"profile {self._details}"
    def summary_label(self) -> str:
        return f"{self.identity_label()}: {self.details_label()}"
# File: src/user_summary_reporter.py
from src.protocols import UserSummaryContract

class UserSummaryReporter:
    def __init__(self) -> None:
        self._summaries: dict[str, str] = {}
    def record_summary(self, summary: UserSummaryContract) -> None:
        self._summaries[summary.identity_label()] = summary.summary_label()
    def format_summary(self, identity: str, details: str) -> str:
        if not identity:
            return f"unknown user: {details}"
        if not details:
            return f"user {identity}: no details"
        return f"user {identity}: profile {details}"
    def report(self) -> None:
        for identity, details in self._summaries.items():
            print(self.format_summary(identity, details))
    def item_count(self) -> int:
        return len(self._summaries)
    def clear(self) -> None:
        self._summaries.clear()

# File: cli.py
from src.user_summary_reporter import UserSummaryReporter
from src.user_summary import UserSummary

if __name__ == "__main__":
    summary = UserSummary("u-1", "Ada")
    reporter = UserSummaryReporter()
    reporter.record_summary(summary)
    if reporter.item_count() > 0:
        reporter.report()
    reporter.clear()
```
