# retry-without-ownership

Description: Reports an unbounded production retry loop: an operation fails, the handler continues the loop, and no attempt owner limits retries.

## Bad

A profile synchronizer retries every failed request forever. No object owns an attempt limit or terminal failure.

```python
# File: src/profile_synchronizer.py
from urllib.parse import urlparse


class ProfileSynchronizer:
    _endpoint: str

    def __init__(self, endpoint: str) -> None:
        self._endpoint: str = endpoint

    def synchronize(self) -> None:
        while True:
            try:
                fetch_profile(self._endpoint)
                return
            except OSError:
                continue

    def endpoint_host(self) -> str:
        parsed = urlparse(self._endpoint)
        host = parsed.hostname
        if host is None:
            raise ValueError("Endpoint must include a host.")
        return host
# File: cli.py
from profile_synchronizer import ProfileSynchronizer

if __name__ == "__main__":
    synchronizer = ProfileSynchronizer("https://example.test/profile")
    synchronizer.synchronize()
    host = synchronizer.endpoint_host()
    print(host)
```
## Good

The same synchronizer owns a finite attempt limit and propagates the final network failure.

```python
# File: src/profile_synchronizer.py
from urllib.parse import urlparse


class ProfileSynchronizer:
    _endpoint: str
    _attempt_limit: int

    def __init__(self, endpoint: str, attempt_limit: int) -> None:
        if attempt_limit < 1:
            raise ValueError("Attempt limit must be positive.")
        self._endpoint: str = endpoint
        self._attempt_limit: int = attempt_limit

    def synchronize(self) -> None:
        for attempt in range(self._attempt_limit):
            try:
                fetch_profile(self._endpoint)
                return
            except OSError:
                if attempt + 1 == self._attempt_limit:
                    raise

    def endpoint_host(self) -> str:
        parsed = urlparse(self._endpoint)
        host = parsed.hostname
        if host is None:
            raise ValueError("Endpoint must include a host.")
        return host
# File: cli.py
from profile_synchronizer import ProfileSynchronizer

if __name__ == "__main__":
    synchronizer = ProfileSynchronizer("https://example.test/profile", 3)
    synchronizer.synchronize()
    host = synchronizer.endpoint_host()
    print(host)
```
