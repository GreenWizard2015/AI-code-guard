# `explicit-field-type`

Description: Require explicit annotations for every Python class field, including class,
instance, dataclass, and `ClassVar` fields. Assignment alone is not a type
declaration. Local variables are not fields merely because they are annotated.

```python
# Bad
class Session:
    def __init__(self, token: str) -> None:
        self.token = token
        self.retries = 0

# Good
class Session:
    _token: str
    _retries: int

    def __init__(self, token: str) -> None:
        self.token = token
        self.retries = 0
```

For a field created only in a constructor, an annotated assignment such as
`self.token: str = token` is also acceptable.

## Bad

```python
# File: src/session.py
class Session:
    def __init__(self, token: str) -> None:
        self.token = token.strip()  # <- error: missing field annotation
        self.retries: int = 0

    def token_length(self) -> int:
        return len(self.token)

    def retry_count(self) -> int:
        return self.retries

    def summary(self) -> str:
        return f"token={self.token}, length={self.token_length()}, refreshes={self.retry_count()}"

    def report(self) -> None:
        print(self.summary())
# File: src/cli.py
from src.session import Session

if __name__ == "__main__":
    session = Session("initial-token")
    session.report()
```

## Good

```python
# File: src/session.py
class Session:
    _token: str
    _retries: int

    def __init__(self, token: str) -> None:
        self._token = token.strip()
        self._retries = 0

    def token_length(self) -> int:
        return len(self._token)

    def retry_count(self) -> int:
        return self._retries

    def summary(self) -> str:
        return f"token={self._token}, length={self.token_length()}, refreshes={self.retry_count()}"

    def report(self) -> None:
        print(self.summary())
# File: src/cli.py
from src.session import Session

if __name__ == "__main__":
    session = Session("initial-token")
    session.report()
```
