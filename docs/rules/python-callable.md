# `python-callable`

**Purpose:** Do not use callable feature detection as a fallback for project-owned interfaces.
The rule applies to Python `callable(...)` and TypeScript `typeof ... ===/!== "function"` checks
inside `if` conditions. It does not target an ordinary value check outside an `if` statement.

```py
if not callable(client.run):
    fallback()

if callable(client.run):
    client.run()
```

```ts
if (typeof client.run !== 'function') {
  fallback();
}

if (typeof client.run === 'function') {
  client.run();
}
```

**Fix:** Type the interface and call its operation directly. If the contract is already an
interface or protocol with method declarations, keep it as-is and inspect the reported node for a
callable field or object-shaped contract before changing it.

```py
from typing import Protocol


class ProfileReader(Protocol):
    def read(self, profile_id: str) -> Profile: ...


class ProfileService:
    reader: ProfileReader

    def __init__(self, reader: ProfileReader):
        self.reader = reader

    def read(self, profile_id: str) -> Profile:
        return self.reader.read(profile_id)
```

Do not replace a valid method-based interface with a class or add a wrapper without owned state,
validation, lifecycle, or domain behavior.
