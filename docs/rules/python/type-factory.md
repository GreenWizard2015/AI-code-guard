# `type-factory`

Description: `namedtuple`, `NamedTuple`, `TypedDict`, and `NewType` can hide project-owned models.

```python
user_type = NamedTuple("User", [("id", str)])
```


Fix: Declare an explicit dataclass or normal class with typed fields.

## Bad

```python
# File: src/user_profile.py
from typing import NamedTuple

UserProfile = NamedTuple("UserProfile", [("user_id", str), ("status", str)])
# File: src/profile_reporter.py
from src.user_profile import UserProfile

class ProfileReporter:
    def __init__(self, profile: UserProfile) -> None:
        self._profile: UserProfile = profile

    def normalized_id(self) -> str:
        return self._profile.user_id.strip().lower()

    def identity_label(self) -> str:
        return f"User {self.normalized_id()}"

    def status_label(self) -> str:
        return f"{self.identity_label()}: {self._profile.status.strip()}"

    def report_line(self) -> str:
        return f"Profile — {self.status_label()}"

    def report(self) -> None:
        print(self.report_line())
# File: src/cli.py
from src.profile_reporter import ProfileReporter
from src.user_profile import UserProfile

if __name__ == "__main__":
    reporter = ProfileReporter(UserProfile("user-1", "ready"))
    reporter.report()
```

## Good

```python
# File: src/user_profile.py
class UserProfile:
    _user_id: str
    _status: str

    def __init__(self, user_id: str, status: str) -> None:
        self._user_id = user_id
        self._status = status

    def normalized_id(self) -> str:
        return self._user_id.strip().lower()

    def identity_label(self) -> str:
        return f"User {self.normalized_id()}"

    def status_label(self) -> str:
        return f"{self.identity_label()}: {self._status.strip()}"

    def report_line(self) -> str:
        return f"Profile — {self.status_label()}"

    def report(self) -> None:
        print(self.report_line())
# File: src/cli.py
from src.user_profile import UserProfile

if __name__ == "__main__":
    profile = UserProfile("user-1", "ready")
    profile.report()
```
