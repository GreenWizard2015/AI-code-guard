# `composite-state-type`

Description: Do not combine named domain contracts with `|` or `&`. Keep simultaneous concepts in named fields; model exclusive runtime states with distinct classes. Literal and nullable unions are covered by other rules.

## Bad

```python
from typing import Protocol

class UserIdentityContract(Protocol):
    id: str

class UserDetailsContract(Protocol):
    name: str

UserSummary = UserIdentityContract | UserDetailsContract  # <- error
```

## Good

Preserve each contract as a typed field and use concrete implementations:

```python
# File: src/protocols.py
from typing import Protocol
class UserIdentityContract(Protocol):
    def normalized_id(self) -> str: ...
    def matches_id(self, candidate: str) -> bool: ...
class UserDetailsContract(Protocol):
    def display_name(self) -> str: ...
    def matches_name(self, candidate: str) -> bool: ...
# File: src/user_identity.py
from src.protocols import UserIdentityContract
class UserIdentity(UserIdentityContract):
    def __init__(self, user_id: str) -> None:
        self.id: str = user_id
    def normalized_id(self) -> str:
        return self.id.strip().lower()
    def matches_id(self, candidate: str) -> bool:
        return self.normalized_id() == candidate.strip().lower()
# File: src/user_details.py
from src.protocols import UserDetailsContract
class UserDetails(UserDetailsContract):
    def __init__(self, name: str) -> None:
        self.name: str = name
    def display_name(self) -> str:
        words = self.name.split()
        return " ".join(words)
    def matches_name(self, candidate: str) -> bool:
        own_name = self.name.strip().lower()
        candidate_name = candidate.strip().lower()
        return own_name == candidate_name
# File: src/user_summary.py
from src.protocols import UserDetailsContract, UserIdentityContract
class UserSummary:
    def __init__(self, identity: UserIdentityContract, details: UserDetailsContract) -> None:
        self.identity: UserIdentityContract = identity
        self.details: UserDetailsContract = details
    def label(self) -> str:
        return f"{self.identity.normalized_id()}: {self.details.display_name()}"
    def matches(self, user_id: str, name: str) -> bool:
        id_matches = self.identity.matches_id(user_id)
        name_matches = self.details.matches_name(name)
        return id_matches and name_matches
    def same_identity(self, other: UserIdentityContract) -> bool:
        return self.identity.normalized_id() == other.normalized_id()
    def same_name(self, other: UserDetailsContract) -> bool:
        return self.details.display_name() == other.display_name()
    def prefixed_label(self, prefix: str) -> str:
        label = self.label()
        return f"{prefix}: {label}"
# File: cli.py
from src.user_details import UserDetails
from src.user_identity import UserIdentity
from src.user_summary import UserSummary
if __name__ == "__main__":
    summary = UserSummary(UserIdentity("u-1"), UserDetails("Ada"))
    label = summary.label()
    matches = summary.matches("u-1", "Ada")
    same_identity = summary.same_identity(UserIdentity("u-1"))
    same_name = summary.same_name(UserDetails("Ada"))
    prefixed_label = summary.prefixed_label("User")
    print(label, matches, same_identity, same_name, prefixed_label)
```
