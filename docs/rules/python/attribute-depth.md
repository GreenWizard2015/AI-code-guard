# `attribute-depth`

Description: Deep object graphs couple callers to implementation details.

## Bad

```python
# File: src/profile.py
from typing import Protocol

class ProfileRecord:
    def __init__(self, identifier: str, display_name: str, contact_address: str, active: bool) -> None:
        self.identifier: str = identifier
        self.display_name: str = display_name
        self.contact_address: str = contact_address
        self.active: bool = active

class UserRecord:
    def __init__(self, profile: ProfileRecord) -> None:
        self.profile: ProfileRecord = profile

class SessionRecord:
    def __init__(self, user: UserRecord) -> None:
        self.user: UserRecord = user

class RequestRecord:
    def __init__(self, session: SessionRecord) -> None:
        self.session: SessionRecord = session

class Profile:
    def __init__(self, request: RequestRecord) -> None:
        self._request: RequestRecord = request

    def user_id(self) -> str:
        return self._request.session.user.profile.identifier

    def display_name(self) -> str:
        return self._request.session.user.profile.display_name

    def contact_address(self) -> str:
        return self._request.session.user.profile.contact_address

    def is_active(self) -> bool:
        return self._request.session.user.profile.active

    def report(self) -> None:
        summary = " | ".join((
            self.user_id(),
            self.display_name(),
            self.contact_address(),
            str(self.is_active()),
        ))
        print(summary)
# File: cli.py
from src.profile import Profile, ProfileRecord, RequestRecord, SessionRecord, UserRecord

if __name__ == "__main__":
    profile_record = ProfileRecord("user-17", "Ada Lovelace", "ada@example.test", True)
    user_record = UserRecord(profile_record)
    session_record = SessionRecord(user_record)
    request = RequestRecord(session_record)
    profile = Profile(request)
    profile.report()
```

**Fix:** Add a named operation or narrow boundary; do not hide the chain in temporary variables.

## Good

Consumers use a small identity boundary instead of traversing the request graph.

```python
# File: src/user_identity.py
from src.protocols import UserIdentityContract

class UserIdentity(UserIdentityContract):
    def __init__(self, identifier: str, name: str, address: str, active: bool) -> None:
        self._identifier: str = identifier
        self._name: str = name
        self._address: str = address
        self._active: bool = active

    def user_id(self) -> str:
        return self._identifier

    def display_name(self) -> str:
        return self._name

    def contact_address(self) -> str:
        return self._address

    def active(self) -> bool:
        return self._active

    def report(self) -> None:
        summary = " | ".join((
            self.user_id(),
            self.display_name(),
            self.contact_address(),
            str(self.active()),
        ))
        print(summary)
# File: src/protocols.py
from typing import Protocol

class UserIdentityContract(Protocol):
    def user_id(self) -> str: ...

    def display_name(self) -> str: ...

    def contact_address(self) -> str: ...

    def active(self) -> bool: ...
# File: cli.py
from src.user_identity import UserIdentity

if __name__ == "__main__":
    identity = UserIdentity("user-17", "Ada Lovelace", "ada@example.test", True)
    identity.report()
```
