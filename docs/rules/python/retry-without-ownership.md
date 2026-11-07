# retry-without-ownership

Description: Reports an unbounded production retry loop: an operation fails, the handler continues the loop, and no attempt owner limits retries.

## Bad

A profile synchronizer retries every failed request forever. No object owns an attempt limit or terminal failure.

```python
# File: src/profile_synchronizer.py
class ProfileSynchronizer:
    _attempts: int

    def _fetch_profile(self) -> None:
        self._attempts += 1
        if self._attempts == 1:
            raise RuntimeError("Temporary profile failure.")

    def __init__(self) -> None:
        self._attempts: int = 0

    def synchronize(self) -> None:
        while True:
            try:
                self._fetch_profile()
                return
            except RuntimeError:
                continue

    def report(self) -> None:
        self.synchronize()
        print("Synchronized local profile")
# File: cli.py
from src.profile_synchronizer import ProfileSynchronizer

if __name__ == "__main__":
    synchronizer = ProfileSynchronizer()
    synchronizer.report()
```
## Good

The same synchronizer owns a finite attempt limit and propagates the final network failure.

```python
# File: src/profile_synchronizer.py
class ProfileSynchronizer:
    _attempt_limit: int

    def _profile_response(self, attempt_number: int) -> str:
        if attempt_number < 2:
            return ""
        profile_words = "local profile".split()
        normalized_words = [profile_word.upper() for profile_word in profile_words]
        return " ".join(normalized_words)

    def __init__(self, attempt_limit: int) -> None:
        if attempt_limit < 1:
            raise ValueError("Attempt limit must be positive.")
        self._attempt_limit: int = attempt_limit

    def synchronize(self) -> str:
        for attempt_number in range(1, self._attempt_limit + 1):
            profile = self._profile_response(attempt_number)
            if profile:
                return profile
            if attempt_number == self._attempt_limit:
                raise RuntimeError("Profile synchronization failed.")
        raise RuntimeError("Profile synchronization ended without a result.")

    def report(self) -> None:
        profile = self.synchronize()
        print(f"Synchronized {profile}")
# File: cli.py
from src.profile_synchronizer import ProfileSynchronizer

if __name__ == "__main__":
    synchronizer = ProfileSynchronizer(3)
    synchronizer.report()
```
