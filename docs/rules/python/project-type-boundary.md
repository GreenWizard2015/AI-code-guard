# `project-type-boundary`

Description: Public callable parameters and results must expose a Protocol, interface, or focused
value contract instead of a project implementation class.


The rule resolves project aliases and generic containers. Depend on a narrow contract.

## Bad


```python
# File: src/user.py
class User:
    def __init__(self, display_name: str, account_id: str) -> None:
        self.__display_name: str = display_name
        self.__account_id: str = account_id

    def content_text(self) -> str:
        return " ".join(self.__display_name.split())

    def initials(self) -> str:
        return "".join(part[0].upper() for part in self.content_text().split())

    def profile_text(self) -> str:
        account_id = self.__account_id.strip().lower()
        return f"{self.initials()}: {self.content_text()} ({account_id})"
# File: src/user_store.py
from src.user import User

class UserStore:
    def __init__(self, user: User, prefix: str) -> None:
        self.__user: User = user
        self.__prefix: str = prefix

    def save(self) -> User:
        print(self.format_saved_user())
        return self.__user

    def format_saved_user(self) -> str:
        prefix_parts = self.__prefix.strip().split()
        normalized_prefix = " ".join(prefix_parts)
        return f"{normalized_prefix}: saved {self.__user.profile_text()}"

    def content_length(self) -> int:
        return len("".join(self.__user.content_text().split()))

    def receipt_text(self) -> str:
        summary = self.format_saved_user()
        content_length = self.content_length()
        return f"{summary} ({content_length} non-space characters)"
# File: cli.py
from src.user import User
from src.user_store import UserStore

if __name__ == "__main__":
    user = User("Ada", "user-1")
    store = UserStore(user, "directory")
    store.receipt_text()
    store.save()
```

## Good


```python
# File: src/protocols.py
from typing import Protocol

class UserReaderContract(Protocol):
    def content_text(self) -> str:
        ...
    def profile_text(self) -> str:
        ...
# File: src/user.py
from src.protocols import UserReaderContract

class User(UserReaderContract):
    def __init__(self, display_name: str, account_id: str) -> None:
        self.__display_name: str = display_name
        self.__account_id: str = account_id

    def content_text(self) -> str:
        return " ".join(self.__display_name.split())

    def initials(self) -> str:
        return "".join(part[0].upper() for part in self.content_text().split())

    def profile_text(self) -> str:
        account_id = self.__account_id.strip().lower()
        return f"{self.initials()}: {self.content_text()} ({account_id})"
# File: src/user_store.py
from src.protocols import UserReaderContract

class UserStore:
    def __init__(self, user: UserReaderContract, prefix: str) -> None:
        self.__user: UserReaderContract = user
        self.__prefix: str = prefix

    def save(self) -> UserReaderContract:
        print(self.format_saved_user())
        return self.__user

    def format_saved_user(self) -> str:
        prefix_parts = self.__prefix.strip().split()
        normalized_prefix = " ".join(prefix_parts)
        return f"{normalized_prefix}: saved {self.__user.profile_text()}"

    def content_length(self) -> int:
        return len("".join(self.__user.content_text().split()))

    def receipt_text(self) -> str:
        summary = self.format_saved_user()
        content_length = self.content_length()
        return f"{summary} ({content_length} non-space characters)"
# File: cli.py
from src.user import User
from src.user_store import UserStore

if __name__ == "__main__":
    user = User("Ada", "user-1")
    store = UserStore(user, "directory")
    store.receipt_text()
    store.save()
```
